# UniSeek 离线视频分析

原始抽样保留在 `uniseek_videos.json`。任务为 `com.hantang.web.task.VideoTypeAndLanguageAnalysisTask`，实现 `Runnable`，不随Web服务自动执行，不写数据库。

从仓库根目录运行。在 `config.secret.properties` 配置 `llm.model`、`llm.base_url`、`llm.api_key`；配置文件已被Git忽略。程序使用HTTPS（本机测试允许HTTP），不输出配置、Authorization、原始供应商错误或思考内容。

## 网页存量打标（PostgreSQL）

当前`/admin/content/video-review`已改为UniSeek内容打标控制台。先手动执行[标签表DDL](../../sql/video_content_labels.sql)，重启后端，进入「管理配置 → 内容 → UniSeek内容打标」。页面展示当前候选集的整体覆盖率，可选择本次数量、增量/全量重打模式及并发数；默认仅打未标记的10000条、8并发，每批20条成功校验后在一个事务里写入`hantang_dynamic.video_content_labels`。具体流程、接口与验证见[控制台说明](../../doc/design/video-label-review.md)。

增量跳过已落库aid，分多天每次选择1万、2万即可继续剩余存量；全量重打覆盖本次选中数量内的自动标签，人工标签保留，模型失败保留原结果。可停止任务，已提交结果不丢；后端重启只恢复展示，继续处理需要显式启动增量。整体统计和页面刷新不调用模型。当前没有定时自动增量任务。

批次输入、追加式请求记录及小型状态快照保存到已忽略的`script/uniseek/labeling-runs/bulk-<UUID>/`。真实标签以PostgreSQL为准。权限/输入准备失败不会开始推理；数据库提交失败会停止任务，不触发模型重试。每批只有COMMIT后才记为入库成功，不生成20万条累计内存JSON。

原固定1000条文件任务和评分器仍可用于离线基准验证，固定人工参考答案不在主页面编辑。旧`/admin/content/video-analysis`接口保留为基准工具，其输出仍为文件，不能与新的生产入库接口混用。

2026-11-18基准结果独立归档：[1000条Qwen结果](runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.json)、[运行统计](runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.run.json)、[开销报告](runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/README.md)。

## 只验证一条视频

也可以在IDE中直接运行任务类的 `main`，工作目录设为仓库根目录，无需参数。默认只读第一条视频；单批失败最多重试2次（最多3次请求），输出保存到 `target/uniseek/analysis-<UUID>.json`，统计另存同名`.run.json`。

也可以构建后指定输入和输出：

```sh
mvn package -DskipTests
java -cp target/hantang-web-backend-1.0-SNAPSHOT.jar \
  com.hantang.web.task.VideoTypeAndLanguageAnalysisTask \
  script/uniseek/uniseek_videos.json target/uniseek/smoke.json
```

已存在的输出文件不会被覆盖；再次运行时请使用新文件名。所有默认产物在已忽略的 `target/` 下。

## 输入、请求与输出

- 只发送选中的视频的 `aid`、`title`、`tag_new`、`description`，提示词从classpath中的 `/prompt/VideoTypeAndLanguageAnalysis.md` 读取；修改后需重新构建或让IDE更新资源。
- 关闭思考和流式输出，设置输出token上限。遵循提示词的顶层JSON数组，不使用要求顶层对象的 `json_object` 模式。
- 解析并校验结果条数、aid及顺序、字段、枚举、语言去重与名称。单批的网络、HTTP、响应JSON、标签JSON或标签校验失败，最多重试2次，仍失败则记录该批失败并继续下一批；不会转成业务标签“否”。
- 兼容完整包在一层 Markdown 代码围栏中的JSON（语言标记为`json`或留空，支持大小写及CRLF换行），只移除外围包装，内部仍严格解析、校验；不截取混有说明文字、多个代码块或不完整围栏中的JSON。
- 文件契约为 `analysis-result.schema.json` 定义的v1：顶层包含 `schema_version`、`source`、`selected_count`、`processed_count`、`status`、`results` 和 `batches`。`source` 为 `llm` 或 `assistant_draft`；供应商未返回token用量时保留 `null`。
- `results` 每条为 `{aid, input, output, review}`：`input` 原样保留标题、标签和简介；`output` 仅包含 `is_song`（是否歌曲）、`is_virtual_singer`（是否虚拟歌手）、`languages`（演唱语言数组）；`review` 包含 `status`（待复核／已确认）与中文 `note`。模型仍只输出简短标签，原始输入由Java本地附回，不让模型复述。
- 请求前预留运行记录，每次尝试保存批次文件与统计，使用临时文件和原子替换；成功批次落盘后才推进进度。结束或可处理的异常退出时按输入顺序写出完整v1结果，不再每次尝试重写累计结果。结果只含成功条目：全部成功为`completed`，部分成功为`partial`，全部失败或任务异常终止为`failed`。运行统计保存每批编号、每次尝试、错误分类、原始失败视频、耗时和用量；全部批次走完但有失败时统计状态为`completed_with_failures`。命令行以退出码2表示这种情况。
- 模型输出不完整、标签JSON解析或字段校验失败时，统计JSON在`batches[].attempts[].raw_model_output`保留该次模型`content`的原始字符串（包含围栏和换行，仅将已配置API Key替换为`[REDACTED]`）。即使重试后成功，此前失败原文仍保留；原文只存每次尝试一份，不复制到失败视频条目，不进入异常消息或控制台日志。网络错误没有模型原文；HTTP错误正文、响应信封、请求头、私密配置和思考内容均不记录。
- 统计JSON的`summary`包含成功/失败/待处理视频数、批次数、尝试与重试数，请求/批次/视频失败率（0—1，仅统计已终结项目，分母为0时为null），总耗时及请求平均/最大耗时。`reported_usage`只累加实际返回值，缺失项计入`usage_missing_attempts`；即使标签解析失败，接口已返回的用量也保留，不能把未知用量当0或把已知合计当完整账单。
- 无效输入等初始化错误也保存运行统计；已存在的输出文件不覆盖。落盘异常会停止后续调用。中断时保留已有结果；尚未实现跨进程自动断点续跑；网页结束后评分及独立离线评分已实现。

额外三个可选参数依次为“最多处理多少条”“每批多少条”和“并发数”（命令行默认分别为1、20和1，每批最多50；并发支持1/4/8/16/32/64）。只有显式提高处理上限才会处理更多视频。当前连通性验证不代表分类准确率已通过验收。已有预测可使用独立评分入口按已确认规则核对。

接口参数依据：[千问兼容Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)、[思考模式](https://help.aliyun.com/zh/model-studio/deep-thinking)。

## 参考答案初稿与人工校正

`reference_answers.json` 使用同一v1契约，`source=assistant_draft`，包含原始1000条视频及逐条初判。它是根据现有标题、标签、简介作出的待审初稿，不表示已观看视频或核验音频。所有条目初始均为“待复核”，`note` 提供边界判断或证据不足的提示。

第一次人工纠正版保存为[`reference_answers.reviewed-round-1.json`](reference_answers.reviewed-round-1.json)。原样归档用户于2026-11-18提供的`reference_answers.reviewed-2026-11-18T12-29-27-873Z.json`，不改写内容或来源字段；保留1000条、原始编号和输入，原始初稿继续独立保留。归档文件SHA-256为`097e48fd8a4e55ded509354161224cbd83c78e4f3c4ff16f2ab97569f818935a`。后续纠正应另存新版本，不覆盖这一轮结果。

用户于2026-11-18确认复核完毕，最终参考答案为[`reference_answers.reviewed-final.json`](reference_answers.reviewed-final.json)，后续评测使用这一版本。它原样保存用户提供的`reference_answers.reviewed-2026-11-18T12-44-53-163Z.json`，1000条均为已确认，编号、顺序与原始输入保持不变，兼容Task的v1契约。SHA-256为`2a825bafffd5fe11de49fcb0f1213012dc6b8cbbf01feb16c2d59834191ec374`。初稿、首次纠正版和最终版分别保留；不改写导出文件的来源字段，不把“复核完成”当作模型准确率已通过验收。本次仅归档与验证，没有调用千问或执行评测。

人工校正时只编辑对应条目的 `output`，确认后将 `review.status` 改为“已确认”；可以保留或补充 `note`。不要改写 `aid` 和 `input`。无法确定的标签可以继续保留“不确定”或“未知语言”；“无语言”只用于已知无语言性演唱的情况。

也可以在冰数据「管理配置 → 内容 → 视频标注复核」（`/admin/content/video-review`）中复核，不必手写JSON。列表直接展示三个初判结果，按用户要求未修改条目默认采用并标为已确认，仅可疑项需要打开抽屉修正，无需点击1000次确认。支持本机草稿暂存、导入已有结果及导出新的复核JSON；原文件保持不变。使用方式见[复核页说明](../../doc/design/video-label-review.md)。

页面默认载入最终参考答案，已有本机草稿仍优先恢复；可点击「载入最终参考答案」显式切换。视频范围可选全部、虚拟歌手歌曲（`is_song=是 AND is_virtual_singer=是`）或其严格补集；补集包含非歌曲、非目标虚拟歌手、混合及不确定条目，不等于只看真人演唱的歌曲。此范围与搜索、不确定和本机调整筛选叠加，导出始终包含全文件。

顶层 `status=completed` 仅表示本次生成已覆盖全部选中条目，不代表人工复核已完成。助手初稿没有API调用，所以 `batches=[]`；千问任务填写实际用量。本轮评分按用户确认的三类规则，以 `aid` 对齐并检查 `input` 一致；语言不参与评分，混合演唱按虚拟歌手计。参考答案无法明确归类时排除分母，缺失预测不得分。核对全部1000条，包含提示词中的6条示例，因此明确不是独立盲测。

旧版 `target/uniseek/smoke-one-video.json` 是v1契约确定前的连通性产物，不自动覆盖；重新运行任务才会生成新格式。生成本次参考答案无需调用千问。

本次已核对1000条的唯一编号、顺序、原始输入及标签格式，并在`LlmClientTest`中通过本机模拟接口按每批50条重放全部参考标签，验证Task输出与参考文件契约一致。这是格式与流程测试，不是千问准确率评测，也不会产生真实LLM调用费用。

## 本地核对与评分

旧1000条基准任务在文件结果保存后可以评分；当前UniSeek生产控制台不把任意选取的候选集与固定1000条参考答案强行评分。离线重评分仍使用同一个评分器，不调用Qwen。评分只使用人工最终参考答案与保存的预测，不产生推理费用。参考答案摘要、规则版本、三类成绩、无法判分及错误明细独立保存为`predictions.score.json`，原文件不改写。

离线使用同一个评分器：

```sh
java -cp target/hantang-web-backend-1.0-SNAPSHOT.jar \
  com.hantang.web.service.labeling.VideoLabelScorer \
  script/uniseek/runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.json
```

可再提供人工参考答案路径及新输出路径；默认使用最终参考答案并将报告另存到`target/uniseek/scores/`。规则与契约见[评分设计](../../doc/design/uniseek/label-scoring.md)。
