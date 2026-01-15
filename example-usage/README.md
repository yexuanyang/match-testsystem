# 添加题目流程
在admin pannel里面创建一个新的题目，然后指定docker image为test-lab:latest（在tmp-Dockerfile里面创建的一个镜像），指定test script,上传tmp.sh，添加题目的markdown描述。mapping path使用默认的/input/submission.zip

# 解答题目的流程
test.zip里面有一个main.py，提交答案界面提交这个.zip文件。然后可以看到答案为100

# 解释
题目定义了一个测试脚本，这个测试脚本在容器启动后直接执行。在测试脚本中解压用户提交的文件，然后放到一个位置，进到这个位置之后执行相关操作得到结果。测试脚本末尾检查结果是否符合预期，然后输出"SCORE: 100"表示拿到了100分。系统收集整个log然后正则匹配整个log，找到"SCORE: "后面那个数字（注意，目前要求整个log只有一次这种样式的分数的输出），然后将分数写到数据库，体现在leaderboard上。
