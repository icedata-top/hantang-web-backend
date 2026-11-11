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
- 输出为包含 `selected_count`、`processed_count`、`status`、`results` 和逐批耗时/token用量的JSON对象。`results` 中每条包含 `aid`、`is_song`、`is_virtual_singer`、`languages`。供应商未返回token用量时保留 `null`。
- 每完成一批保存一次报告。运行中为 `running`／`partial`，全部成功为 `completed`；调用或解析失败时为 `failed`，保留已成功的结果，不填充失败项。尚未实现自动断点续跑或评分。

额外两个可选参数依次为“最多处理多少条”和“每批多少条”（默认分别为1和20，每批最多50）。只有显式提高处理上限才会处理更多视频。当前连通性验证不代表分类准确率已通过验收，也没有参考答案评分。

接口参数依据：[千问兼容Chat API](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)、[思考模式](https://help.aliyun.com/zh/model-studio/deep-thinking)。
