# PJ1 Phase 1：CLI 版 SVG 编辑器

> 本文档按课程要求组织为四节：**架构方案**、**过程记录**、**一致性自查**、**质量保证手段**。
> 架构方案在编码前定稿；后三节随实现推进持续更新（当前状态：**实现完成**，全部测试与静态检查通过）。

---

## 一、架构方案

### 1.1 项目概述

一个命令行交互（REPL）的 SVG 编辑器：通过 `svg>` 提示符逐行读入命令，完成 SVG 文档的
`init / read / save` 与图形的 `create / delete / move / scale / set / group / ungroup / addto /
front / back` 等编辑操作，支持 `tree / show / help` 查看，以及 `undo / redo` 撤销重做。
实现语言为 TypeScript，采用面向对象范式（类层次 + 多态）。

### 1.2 模块划分

| 目录 | 职责 | 关键类 / 接口 |
|---|---|---|
| `src/model/` | **领域核心**：纯内存对象树与几何语义，不依赖任何外层模块 | `Shape`(抽象基类) · `Container`(抽象) · `Group` · `Rect` / `Circle` / `Ellipse` / `Line` / `Text` · `SvgDocument` · `errors.ts` |
| `src/shapes/` | 图形类型注册与插件缝（按名分派的唯一两处之一） | `ShapeProvider`(接口) · `ShapeFactory` · `builtin/` 六个内置 Provider |
| `src/commands/` | Command 模式的落地：一类一文件（按名分派的唯一两处之一） | `Command`(接口) · 各具体命令类 · `CommandRegistry` |
| `src/history/` | 撤销/重做双栈，以及"IO 命令后锁定"的策略 | `HistoryManager` |
| `src/io/` | SVG 文本读写与文件访问端口（依赖倒置，隔离真实 IO） | `SvgWriter` · `SvgReader` · `FileStore`(接口) · `NodeFileStore` · `MemoryFileStore` |
| `src/parser/` | 行输入词法分析（注释、引号）与命令语法解析 | `Tokenizer` · `CommandParser` |
| `src/cli/` | REPL 循环、输出格式化、错误呈现 | `Repl` · `OutputFormatter` |
| `src/main.ts` | 组装各模块依赖并启动 REPL | — |
| `test/` | 单元测试与集成测试（含典型会话 transcript 夹具） | — |

**组件图**

```plantuml
@startuml
skinparam componentStyle rectangle
package "cli"      { [Repl] [OutputFormatter] }
package "parser"   { [Tokenizer] [CommandParser] }
package "commands" { [CommandRegistry] [Command] }
package "history"  { [HistoryManager] }
package "model"    { [Shape / Container / Group] [SvgDocument] }
package "shapes"   { [ShapeFactory] [ShapeProvider] }
package "io"       { [SvgWriter] [SvgReader] [FileStore] }

[Repl] --> [Tokenizer]
[Repl] --> [CommandParser]
[Repl] --> [HistoryManager]
[Repl] --> [CommandRegistry]
[CommandRegistry] ..> [Command] : creates
[Command] ..> [CommandParser] : ParsedCommand
[HistoryManager] --> [Command]
[Command] --> [SvgDocument]
[Command] --> [ShapeFactory]
[Command] ..> [FileStore]
[ShapeFactory] --> [ShapeProvider]
[SvgWriter] --> [SvgDocument]
[SvgReader] --> [ShapeFactory]
[FileStore] <|.. [NodeFileStore]
[FileStore] <|.. [MemoryFileStore]
@enduml
```

### 1.3 设计模式的选择与落地

| 模式 | 落地位置 | 解决什么问题 |
|---|---|---|
| **Command** | `src/commands/*`，每个命令对象内部持有撤销所需的旧值 / 父节点与索引 | 每次编辑被封装为一个对象，统一 `execute / undo / isUndoable` 接口；撤销栈只依赖接口，不关心具体命令 |
| **Composite** | `Shape` → `Container` → `Group`，与各叶子图形并列 | 容器与叶子对 `move / scale / set / delete` **一视同仁**；`Group` 将操作递归到子节点，实现"改一个 `<g>` 即改整棵子树" |
| **Factory / Registry** | `ShapeFactory`（类型名→Provider）、`CommandRegistry`（命令名→构造器） | 收敛**唯一两处**按名分派；其余位置一律走多态，杜绝 `switch(tag)` |
| **Memento** | 命令内部保存的"旧属性值 / 父 id + 插入位置"最小快照 | 为精确撤销提供状态，避免全量快照带来的内存开销 |
| **Adapter / Ports** | `FileStore` 接口 + `NodeFileStore` / `MemoryFileStore` 两个实现 | 隔离真实文件系统；命令只依赖接口，测试可用内存实现不落盘 |
| **Template Method** | `Shape` 基类定义 `toXml / scaleBy` 的骨架，子类只填几何细节 | 序列化与变换逻辑各归各类，消灭集中式 `switch(tag)` |

> 按名分派的两处（`CommandRegistry`、`ShapeFactory`）在代码中以注释显式标注为 **待重构**。

### 1.4 依赖方向规则

**允许的依赖（外 → 内，单向）**

| 模块 | 可依赖 |
|---|---|
| `cli` | `parser` / `commands` / `history` / `io` / `model` |
| `parser` | `model` |
| `commands` | `model` / `shapes` / `io`(仅 `FileStore` 接口) / `parser`(仅 `ParsedCommand` 类型) |
| `history` | `commands`(仅 `Command` 接口) |
| `io` | `model` / `shapes` |
| `shapes` | `model` |
| `model` | **无**（领域核心，零依赖） |

**禁止的依赖（违反即为待处理项）**

- `model` → 任何外层模块（`cli` / `io` / `commands` / `shapes`）；
- `io` → `commands` / `cli` / `history`；
- 任何模块 → `cli`；
- `commands` → `history`（**命令不认识撤销栈**，由 `HistoryManager` 主动调用命令，保证命令可被独立构造与测试）。

**理由**：领域模型（`model`）是系统中最稳定、最值得复用的部分，任何反向依赖都会使几何语义
被 IO 或交互细节污染。`commands` 与 `history` 解耦后，命令可以脱离撤销栈单独测试。

### 1.5 变化点假设

| # | 未来最可能变化之处 | 处理方式 |
|---|---|---|
| 1 | **新增图形类型**（如 `box`、`hexagon`） | **留了缝**：`ShapeProvider` 插件接口 + `ShapeFactory` 注册表。新类型只需注册一个 Provider；`box` 的 `set` 传播语义（fill→rect、label→text）、序列化标记、读回还原全部由插件提供，**内核改 0 行** |
| 2 | **新增命令** | **留了缝**：向 `CommandRegistry` 注册即可，不动解析器与 REPL |
| 3 | **几何语义扩展**（`rotate`、仿射变换矩阵） | **决定不留**：本阶段一律采用绝对坐标递归，不引入 `transform` 矩阵模型（见 1.6 关键决策 1）。若将来需要，在 `Shape` 的变换钩子处扩展即可 |
| 4 | **撤销粒度 / 策略变化** | **留了缝**：策略集中在 `HistoryManager` 一处，改策略不影响任何命令 |
| 5 | **存储 / 持久化方式变化**（多文档、云端） | **只留一层**：`FileStore` 接口，不做过早抽象 |
| 6 | **属性白名单扩展** | **天然可扩**：每类 `Shape` 自行声明可设属性，新增属性只改对应类 |
| 7 | **输入通道扩展**（脚本文件回放、AI agent、鼠标） | **部分留缝**：`parser` 与 `Repl` 已解耦，脚本回放成本极低；图形界面通道**决定不留**（当前无此需求，避免过度设计） |

### 1.6 关键设计决策

1. **容器变换 = 递归修改子孙的绝对坐标，绝不写 `transform` 属性。**
   依据：规范中 `move` 容器为"整体平移"、`scale` "作用于容器时递归到每个子孙"、`ungroup` 子图形
   "占据原容器的位置"，均指向绝对坐标语义；`tree` 命令也因此能显示每个图形的真实坐标。
   代价：读到外部 SVG 中携带的 `transform` 时本阶段**忽略**（不烘焙进坐标），记为本阶段已知限制；
   本编辑器写出的文件不含 `transform`，`read → save → read` 往返稳定。
2. **`init / read / save / canvas(改尺寸)` 同样是 Command 对象**，走同一条分派路径，但其
   `isUndoable = false`；执行后由 `HistoryManager` 锁定 undo/redo，直到下一次编辑命令重新解禁。
3. **XML 读取使用成熟库（`fast-xml-parser`），写出为手写实现。** 读取侧不手写解析器以降低 bug 面；
   写入侧逻辑简单，手写以便精确控制缩进与转义格式。

---

## 二、过程记录

> 记录与 AI 协作中关键的讨论、发现的问题与纠正过程。随实现推进补充。

### 2.1 架构选型：三方案对比，选定分层架构

AI 提出了三种候选架构（分层架构 / Command 中心扁平结构 / 全量快照式 undo）。经权衡：

- **全量快照式 undo** 被否决：虽然实现极简，但会让"命令对象能撤销自己"这一 Command 模式
  的核心考点落空，答辩时难以自圆其说；
- **扁平结构** 被否决：`Document` 易演化为上帝类，IO 与领域耦合，且后续 `box` 插件没有插槽；
- **分层架构** 采纳：课程评分点（模块划分、依赖方向、变化点假设）与其一一对应。

### 2.2 关于容器变换语义的确认

AI 最初倾向"符合 SVG 惯例"地给 `<g>` 写入 `transform` 属性。检查规范后确认不可行：`tree` 输出
要求显示子图形真实坐标、`ungroup` 要求子图形"占据原容器的位置"，而 `transform` 方案下子图形
坐标不变、靠渲染期矩阵生效，与本编辑器"脱离画布工作"的目标冲突。最终决定改为**递归改绝对坐标**，
并把"忽略外部 `transform`"记为本阶段已知限制。

### 2.3 模块划分的两次修正（对照实现）

初稿模块表里出现过两个后来被否掉的文件：

- `src/cli/TreeFormatter.ts`：原打算把 `tree` / `show` 的渲染放在 CLI 层。但 `tree` / `show` 是
  **命令**，必须走命令分发（规范只允许两处按名分派），而 `commands` 不允许依赖 `cli`。若保留该文件
  就会形成 `commands → cli` 的反向依赖。最终把渲染直接实现在 `commands/TreeCommand.ts` /
  `commands/ShowCommand.ts` 内，只用 `model` 的 `summary()` 等接口，`src/cli/` 只保留
  `OutputFormatter` 与 `Repl`。
- `src/app/EditorSession.ts`：一度计划新增 `app` 层承载"可测试的会话"。实际实现时发现，只要让
  `Repl` 暴露一个 `runLine()` 并把"打印输出"作为构造参数注入，集成测试即可脱离终端直接驱动，
  无需新增模块。故 `app` 层被撤销，`Repl` 归入 `cli`。

结论：**实际目录 = `model / shapes / commands / history / io / parser / cli` + `main.ts`**，
与 §1.2 模块表一致（模块表中未再出现 `TreeFormatter` 与 `app`）。

### 2.4 undo/redo 的归属：让命令不认识撤销栈

方案 §1.4 规定 `commands` 不能依赖 `history`。但 `undo` / `redo` 天然要操作撤销栈，若把
`HistoryManager` 注入命令就违反了规则。折中方案：在 `commands` 内定义端口
`HistoryFacade`（`undo(ctx) / redo(ctx)`），`HistoryManager` 结构化地满足它；`undo` / `redo`
实现为 `HistoryCommand`，由 REPL 通过 `executeOn(history, ctx)` 驱动。这样按名分派仍只发生在
`CommandRegistry` 一处，编辑类命令依旧完全不认识撤销栈。

### 2.5 tree 输出的列宽偏差

规范 §5.1 的树形示例把几何摘要对齐到第 19 列，但 §6.1 / §4.4 的示例分别对齐到第 29 / 31 列，
规范自身不一致，无法逐字节复现。实现固定采用**第 19 列、至少一个空格**，集成测试对空白做归一化
（`\s+ → 单空格` 并去首尾空白）后再比对，从而既验证内容与顺序，又不被列宽差异干扰。

同一段会话回放还暴露了缩进前缀的另一个坑：规范 §5.1 / §6 对"非末位父节点"的子级使用 `│   `
竖线续行前缀——末位父节点的子级缩进四个空格（如 §6 的 `g#markers` 是全树最后一个子节点），
非末位父节点的子级再加竖线（如 §6.1 的 `g#node1`，其后还有 `g#node2`）。
实现严格按规范输出 `│   ` 前缀；最初的集成测试期望值漏掉了该前缀，回放发现后**以规范为准修正了期望值**，
实现代码未改。归一化（折叠空白）后，`│   ├──` 与期望的 `│ ├──` 等价。

### 2.6 回放规范 transcript 揪出的两个真实 bug

Task 15 完成后，用规范 §6 的完整会话在真实终端逐行回放，暴露出两个单元测试未覆盖的真实缺陷：

1. **`group` 之后按 id 查不到成员。** `GroupCommand` 起初直接 `this.group.insert(member)` 写入
   子节点，绕过了 `SvgDocument` 的索引重建，导致 `group` 后 `move c1` 报 `no such shape: c1`。
   根因：违反了"结构变更唯一入口是 `doc.attach/detach`"这一设计约束。
2. **`group → undo → redo` 会重复挂载成员。** `undo` 只解挂了 group 本身，未清空 group 的子节点，
   于是 `redo` 时成员被再次挂入，一份图形出现两次。

修法：`GroupCommand.execute` 改为经 `doc.detach` / `doc.attach` 路由，`undo` 先逐个解挂成员再解挂
group；同时补了两个回归测试（"每个成员按 id 仍可查"、"undo 后 redo 每个成员恰好一次"）。此修复作为
独立的 `fix(commands): …` 提交，未与功能提交混在一起。教训：**集成回放不可省略**——只跑单元测试时
这两个缺陷都是隐形的。

---

## 三、一致性自查

> 实现完成后，对照本方案如实填写。

1. **模块划分**：实际目录与方案是否一致？不一致之处是否已记入修订记录？
   —— 一致。实际为 `src/{model,shapes,commands,history,io,parser,cli}` + `src/main.ts`
   + `test/{model,shapes,commands,history,io,parser,cli,helpers,integration}`，与 §1.2 完全对应。
   过程中确有偏差（`TreeFormatter` 未建、`app` 层未建），均已记入 2.3 修订记录。
2. **依赖方向**：方案里的规则有没有被违反？抽样检查代码中的依赖关系。
   —— 未发现违例。抽样：
   - `src/model/*` 仅互相引用，零外部依赖；
   - `src/parser/CommandParser.ts` 仅依赖 `./Tokenizer` 与 `model/errors`（**不依赖 `commands`**）；
   - `src/commands/*` 仅依赖 `model` / `shapes` / `io/FileStore`(接口) / `parser/CommandParser`(类型)，
     **不 import `history`**（`undo`/`redo` 经 `HistoryCommand` 端口，见 2.4）；
   - `src/history/HistoryManager.ts` 只依赖 `commands` 的 `Command` 接口与 `model/errors`；
   - `src/io/SvgReader.ts` 依赖 `model` 与 `shapes`，不依赖 `commands` / `cli`；
   - 任何模块都不 import `cli`。

   两处按名分派（`CommandRegistry` 构造命令、`ShapeFactory` 构造图形）在源码内以注释显式标注为
   **待重构**，其余位置（`move/scale/set/delete/…`、`toXml`、`scaleBy`）一律走多态，全文无
   `switch(tag)`。

---

## 四、质量保证手段

> 说明如何确认代码在功能上完整、以及质量有足够信心的依据。

- **单元测试**（Vitest）：覆盖每个 `Shape` 的 `translate / scaleBy / setAttr / toXml`、
  `SvgDocument` 的索引与查找、`HistoryManager` 的栈行为、`SvgWriter` 的转义与格式、
  `SvgReader` 的自动补 id 与告警、`Tokenizer` 的引号 / 注释 / 非法输入处理。
- **集成测试**：将课程规范第 6 节"典型会话"与 6.1"两节点流程图"的完整 transcript 作为夹具，
  逐行喂入命令并断言输出，直接验证功能完整性，同时作为回归测试。
- **往返测试**：`read → save → read` 结构等价。
- **IO 隔离**：全部测试使用 `MemoryFileStore`，不触碰真实文件系统，测试可重复且无副作用。
- **静态检查**：TypeScript 严格模式（`noUncheckedIndexedAccess` / `verbatimModuleSyntax` /
  `noImplicitOverride`）+ ESLint，保证类型与风格一致性。
- **可复现的命令**：`npm test`（Vitest 全量）、`npm run typecheck`（`tsc --noEmit`）、
  `npm run lint`（ESLint）、`npm run coverage`（`vitest run --coverage`，v8 provider）。
- **提交时的实测结果**：全量 **107 个测试全部通过**（19 个测试文件）；`tsc --noEmit` 与
  `eslint .` 均零告警。覆盖率（行）实测：总体 **85.9%**，分模块 `history` 96.9%、`cli` 92.6%、
  `commands` 86.9%、`io` 84.9%、`model` 79.5%。`model` 偏低主要落在 `Ellipse` / `Line` 的几何
  分支；`io/NodeFileStore`（真实文件系统适配器）与 `main.ts`（纯组装）**不在测试范围内**，故近
  0% 覆盖——两者都只是一层薄适配，逻辑已在 `MemoryFileStore` 与集成测试中覆盖。
- **手工冒烟**：按规范 §6 / §6.1 的两段 transcript 在真实终端（`npm run cli`）逐条回放，
  输出与文档一致——正是这一步骤揪出了 2.6 记录的两个真实缺陷。
