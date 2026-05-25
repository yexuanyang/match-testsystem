# 使用示例

本目录包含了系统使用的完整示例，包括基础评测和性能指标评测。

## 示例1：基础评测（tmp.sh）

### 添加题目流程
在 Admin Panel 里面创建一个新的题目，然后指定 docker image 为 `test-lab:latest`（在 tmp-Dockerfile 里面创建的一个镜像），指定 test script，上传 `tmp.sh`，添加题目的 markdown 描述。mapping path 使用默认的 `/input/submission.zip`

### 解答题目的流程
test.zip 里面有一个 main.py，提交答案界面提交这个 .zip 文件。然后可以看到答案为 100。

### 解释
题目定义了一个测试脚本，这个测试脚本在容器启动后直接执行。在测试脚本中解压用户提交的文件，然后放到一个位置，进到这个位置之后执行相关操作得到结果。测试脚本末尾检查结果是否符合预期，然后输出 `SCORE: 100` 表示拿到了 100 分。系统收集整个 log 然后正则匹配整个 log，找到 `SCORE:` 后面那个数字（注意，目前要求整个 log 只有一次这种样式的分数的输出），然后将分数写到数据库，体现在 leaderboard 上。

## Submission Mapping Path

`Submission Mapping Path` 支持两种写法：

1. 具体文件路径：例如 `/input/submission.zip`。系统会把学生提交的文件挂载到这个固定位置。
2. 目录路径：例如 `/workspace/` 或 `/workspace`。系统会保留学生提交文件的原始文件名，并挂载到目录下。

举例：如果学生提交的文件名是 `20240001.zip`，题目的 mapping path 填 `/workspace/`，那么评测容器里会看到 `/workspace/20240001.zip`。这适合需要从答案文件名读取学号或其他学生信息的题目。

答案文件支持 `.zip`、`.tar`、`.gz`、`.tar.gz`、`.csv`、`.txt`、`.json`、`.py`、`.patch`、`.diff`。报告文件仍然只建议上传 PDF。

## 示例2：性能指标评测（tmp_performance.sh）

### 添加题目流程
1. 在 Admin Panel 创建新题目
2. 指定 docker image 为 `test-lab:latest`
3. 指定 test script，上传 `tmp_performance.sh`
4. **启用 Performance Tracking 开关**
5. **设置 Performance Unit**，例如 `分`（或其他单位如 `s`、`ms`、`%` 等）
6. 添加题目的 markdown 描述
7. mapping path 使用默认的 `/input/submission.zip`

### 解答题目的流程
与基础示例相同，提交 test.zip 文件。除了看到分数 100 外，还会在提交历史中看到性能指标列显示 `99.6 分`

### 解释
这个示例在基础评测的基础上增加了性能指标输出：

1. **分数输出**：`SCORE: 100` - 正确性评分
2. **性能输出**：`PERFORMANCE: 99.6` - 性能指标值

系统会：
- 匹配 `SCORE:` 后面的数字作为分数
- **仅在题目启用了 Performance Tracking 时**，匹配 `PERFORMANCE:` 后面的数字作为性能指标
- 性能指标值会与设置的单位一起显示在提交历史的 Performance 列中

### 性能指标的应用场景

性能指标功能适用于需要评估以下方面的题目：
- **执行时间**：算法效率测试（单位：`s`、`ms`）
- **内存使用**：资源优化测试（单位：`MB`、`KB`）
- **准确率/精度**：机器学习模型评测（单位：`%`、`分`）
- **吞吐量**：系统性能测试（单位：`ops/s`、`MB/s`）
- **其他自定义指标**：根据题目需求设置

### 注意事项

- 如果题目**未启用** Performance Tracking，即使测试脚本输出了 `PERFORMANCE:`，系统也不会解析和存储
- Performance 列对于未启用性能追踪的题目会显示 `N/A`
- 如果启用了但测试脚本未输出性能数据，会显示 `-`
- 性能指标值可以是任何有意义的数字，由测试脚本的逻辑决定
