#!/bin/bash
echo "Begin tests"
unzip /input/submission.zip -d /input/dest_dir
cd /input/dest_dir
python3 main.py > /tmp/result
cat << EOF > /tmp/check.py
with open("/tmp/result", "r") as f:
    s = f.read()
    if "hello,world!" in s:
        print("SCORE: 100")
        print("PERFORMANCE: 99.6")
EOF
python3 /tmp/check.py
sleep 30
