# UniSeek 离线视频分析

原始抽样保留在 `uniseek_videos.json`。离线任务为 `com.hantang.web.task.VideoTypeAndLanguageAnalysisTask`，实现 `Runnable`，不随Web服务启动，不写数据库。

从仓库根目录运行。在 `config.secret.properties` 配置 `llm.model`、`llm.base_url`、`llm.api_key`；配置文件已被Git忽略。程序使用HTTPS（本机测试允许HTTP），不输出配置、Authorization、原始供应商错误或思考内容。

## 只验证一条视频

在IDE中直接运行任务类的 `main`，工作目录设为仓库根目录，无需参数。默认只读第一条视频、发送一次请求，不自动重试；输出保存到 `target/uniseek/analysis-<UUID>.json`。

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
- 解析并校验结果条数、aid及顺序、字段、枚举、语言去重与名称；截断、拒答、解析失败或HTTP错误均使任务失败，不转换成业务标签“否”。
- 文件契约为 `analysis-result.schema.json` 定义的v1：顶层包含 `schema_version`、`source`、`selected_count`、`processed_count`、`status`、`results` 和 `batches`。`source` 为 `llm` 或 `assistant_draft`；供应商未返回token用量时保留 `null`。
- `results` 每条为 `{aid, input, output, review}`：`input` 原样保留标题、标签和简介；`output` 仅包含 `is_song`（是否歌曲）、`is_virtual_singer`（是否虚拟歌手）、`languages`（演唱语言数组）；`review` 包含 `status`（待复核／已确认）与中文 `note`。模型仍只输出简短标签，原始输入由Java本地附回，不让模型复述。
- 每完成一批保存一次报告。运行中为 `running`／`partial`，全部成功为 `completed`；调用或解析失败时为 `failed`，保留已成功的结果，不填充失败项。尚未实现自动断点续跑或评分。

额外两个可选参数依次为“最多处理多少条”和“每批多少条”（默认分别为1和20，每批最多50）。只有显式提高处理上限才会处理更多视频。当前连通性验证不代表分类准确率已通过验收，也没有参考答案评分。

接口参数依据：[千问兼容Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)、[思考模式](https://help.aliyun.com/zh/model-studio/deep-thinking)。

## 参考答案初稿与人工校正

`reference_answers.json` 使用同一v1契约，`source=assistant_draft`，包含原始1000条视频及逐条初判。它是根据现有标题、标签、简介作出的待审初稿，不表示已观看视频或核验音频。所有条目初始均为“待复核”，`note` 提供边界判断或证据不足的提示。

人工校正时只编辑对应条目的 `output`，确认后将 `review.status` 改为“已确认”；可以保留或补充 `note`。不要改写 `aid` 和 `input`。无法确定的标签可以继续保留“不确定”或“未知语言”；“无语言”只用于已知无语言性演唱的情况。

顶层 `status=completed` 仅表示本次生成已覆盖全部选中条目，不代表人工复核已完成。助手初稿没有API调用，所以 `batches=[]`；千问任务填写实际用量。后续评分应按 `aid` 对齐并检查 `input` 一致，只将已确认的参考答案作为人工真值；语言数组按集合比较。提示词引用的6条真实示例应排除在独立盲测成绩之外。

旧版 `target/uniseek/smoke-one-video.json` 是v1契约确定前的连通性产物，不自动覆盖；重新运行任务才会生成新格式。生成本次参考答案无需调用千问。

本次已核对1000条的唯一编号、顺序、原始输入及标签格式，并在`LlmClientTest`中通过本机模拟接口按每批50条重放全部参考标签，验证Task输出与参考文件契约一致。这是格式与流程测试，不是千问准确率评测，也不会产生真实LLM调用费用。
