# UniSeek 离线视频分析

原始抽样保留在 `uniseek_videos.json`。任务为 `com.hantang.web.task.VideoTypeAndLanguageAnalysisTask`，实现 `Runnable`，不随Web服务自动执行，不写数据库。

从仓库根目录运行。在 `config.secret.properties` 配置 `llm.model`、`llm.base_url`、`llm.api_key`；配置文件已被Git忽略。程序使用HTTPS（本机测试允许HTTP），不输出配置、Authorization、原始供应商错误或思考内容。

## 网页执行

重启本机后端后，打开冰数据「管理配置 → 内容 → 视频标注复核」(`/admin/content/video-review`)，点击「Qwen批量标记 → 开始执行」。复用已有Java客户端及任务，对固定的1000条原始样本每批20条标记；网页每秒读取进度，显示成功/失败数、当前批次/尝试、耗时、请求失败率和已知token用量。页面加载和进度刷新只读，点击按钮才会发起推理；同一时间只运行一个任务。

每次点击「开始执行」都会从头处理完整1000条，不会只补跑之前失败的视频；每次创建新的运行目录，保留前次结果。目前尚未实现按失败条目补跑及结果合并。

结果自动保存至`script/uniseek/runs/web-<UUID>/predictions.json`，统计保存至同目录`predictions.run.json`，网页可以下载两份JSON。刷新网页或切换菜单不会中止已启动任务，回到页面可继续看进度。执行接口只接受直接的本机连接及本机Origin，密钥由Java读取；浏览器不接触API密钥。生产反向代理不开放此付费执行入口。

2026-11-18 完整运行已归档：[1000条Qwen结果](runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.json)、[运行统计](runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.run.json)、[耗时、token、费用及失败原因报告](runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/README.md)。本次全部1000条成功，耗时564.347秒，接口返回422,448 token；后续验证使用这一轮结果，准确率尚未评测。

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
- 请求前预留JSON文件，每次尝试前后保存快照，使用临时文件和原子替换保留完整JSON。结果只含成功条目：全部成功为`completed`，部分成功为`partial`，全部失败或任务异常终止为`failed`。运行统计保存每批编号、每次尝试、错误分类、原始失败视频、耗时和用量；全部批次走完但有失败时统计状态为`completed_with_failures`。命令行以退出码2表示这种情况。
- 模型输出不完整、标签JSON解析或字段校验失败时，统计JSON在`batches[].attempts[].raw_model_output`保留该次模型`content`的原始字符串（包含围栏和换行，仅将已配置API Key替换为`[REDACTED]`）。即使重试后成功，此前失败原文仍保留；原文只存每次尝试一份，不复制到失败视频条目，不进入异常消息或控制台日志。网络错误没有模型原文；HTTP错误正文、响应信封、请求头、私密配置和思考内容均不记录。
- 统计JSON的`summary`包含成功/失败/待处理视频数、批次数、尝试与重试数，请求/批次/视频失败率（0—1，仅统计已终结项目，分母为0时为null），总耗时及请求平均/最大耗时。`reported_usage`只累加实际返回值，缺失项计入`usage_missing_attempts`；即使标签解析失败，接口已返回的用量也保留，不能把未知用量当0或把已知合计当完整账单。
- 无效输入等初始化错误也保存运行统计；已存在的输出文件不覆盖。落盘异常会停止后续调用。中断时保留已有结果；尚未实现跨进程自动断点续跑或评分。

额外两个可选参数依次为“最多处理多少条”和“每批多少条”（默认分别为1和20，每批最多50）。只有显式提高处理上限才会处理更多视频。当前连通性验证不代表分类准确率已通过验收，也没有参考答案评分。

接口参数依据：[千问兼容Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)、[思考模式](https://help.aliyun.com/zh/model-studio/deep-thinking)。

## 参考答案初稿与人工校正

`reference_answers.json` 使用同一v1契约，`source=assistant_draft`，包含原始1000条视频及逐条初判。它是根据现有标题、标签、简介作出的待审初稿，不表示已观看视频或核验音频。所有条目初始均为“待复核”，`note` 提供边界判断或证据不足的提示。

第一次人工纠正版保存为[`reference_answers.reviewed-round-1.json`](reference_answers.reviewed-round-1.json)。原样归档用户于2026-11-18提供的`reference_answers.reviewed-2026-11-18T12-29-27-873Z.json`，不改写内容或来源字段；保留1000条、原始编号和输入，原始初稿继续独立保留。归档文件SHA-256为`097e48fd8a4e55ded509354161224cbd83c78e4f3c4ff16f2ab97569f818935a`。后续纠正应另存新版本，不覆盖这一轮结果。

用户于2026-11-18确认复核完毕，最终参考答案为[`reference_answers.reviewed-final.json`](reference_answers.reviewed-final.json)，后续评测使用这一版本。它原样保存用户提供的`reference_answers.reviewed-2026-11-18T12-44-53-163Z.json`，1000条均为已确认，编号、顺序与原始输入保持不变，兼容Task的v1契约。SHA-256为`2a825bafffd5fe11de49fcb0f1213012dc6b8cbbf01feb16c2d59834191ec374`。初稿、首次纠正版和最终版分别保留；不改写导出文件的来源字段，不把“复核完成”当作模型准确率已通过验收。本次仅归档与验证，没有调用千问或执行评测。

人工校正时只编辑对应条目的 `output`，确认后将 `review.status` 改为“已确认”；可以保留或补充 `note`。不要改写 `aid` 和 `input`。无法确定的标签可以继续保留“不确定”或“未知语言”；“无语言”只用于已知无语言性演唱的情况。

也可以在冰数据「管理配置 → 内容 → 视频标注复核」（`/admin/content/video-review`）中复核，不必手写JSON。列表直接展示三个初判结果，按用户要求未修改条目默认采用并标为已确认，仅可疑项需要打开抽屉修正，无需点击1000次确认。支持本机草稿暂存、导入已有结果及导出新的复核JSON；原文件保持不变。使用方式见[复核页说明](../../doc/design/video-label-review.md)。

页面默认载入最终参考答案，已有本机草稿仍优先恢复；可点击「载入最终参考答案」显式切换。视频范围可选全部、虚拟歌手歌曲（`is_song=是 AND is_virtual_singer=是`）或其严格补集；补集包含非歌曲、非目标虚拟歌手、混合及不确定条目，不等于只看真人演唱的歌曲。此范围与搜索、不确定和本机调整筛选叠加，导出始终包含全文件。

顶层 `status=completed` 仅表示本次生成已覆盖全部选中条目，不代表人工复核已完成。助手初稿没有API调用，所以 `batches=[]`；千问任务填写实际用量。后续评分应按 `aid` 对齐并检查 `input` 一致，只将已确认的参考答案作为人工真值；语言数组按集合比较。提示词引用的6条真实示例应排除在独立盲测成绩之外。

旧版 `target/uniseek/smoke-one-video.json` 是v1契约确定前的连通性产物，不自动覆盖；重新运行任务才会生成新格式。生成本次参考答案无需调用千问。

本次已核对1000条的唯一编号、顺序、原始输入及标签格式，并在`LlmClientTest`中通过本机模拟接口按每批50条重放全部参考标签，验证Task输出与参考文件契约一致。这是格式与流程测试，不是千问准确率评测，也不会产生真实LLM调用费用。
