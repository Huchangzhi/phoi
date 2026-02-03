# reorganize_luogu_problems.py
import json
import os
import re
from collections import defaultdict

INPUT_FILE = "latest.ndjson"
CHUNK_SIZE = 20
OUTPUT_DIR = "."  # 当前目录

def parse_pid(pid):
    """提取题号数字，如 P1001 -> (1001, 'P')"""
    match = re.match(r"^([BP])(\d+)$", pid.strip(), re.IGNORECASE)
    if not match:
        return None, None
    prefix = match.group(1).upper()
    num = int(match.group(2))
    return num, prefix

def main():
    problems_by_type = defaultdict(list)

    # 1. 读取所有题目并分类
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                prob = json.loads(line)
                pid = prob.get("pid")
                if not pid:
                    continue
                num, prefix = parse_pid(pid)
                if num is None:
                    continue
                problems_by_type[prefix].append((num, pid, prob))
            except Exception as e:
                print(f"跳过无效行: {line[:50]}... ({e})")

    # 2. 对每类题目按题号排序
    index_data = {
        "types": {}
    }

    for ptype in ["P", "B"]:
        if ptype not in problems_by_type:
            continue

        problems = problems_by_type[ptype]
        problems.sort(key=lambda x: x[0])  # 按题号数字排序

        chunks = []
        total = len(problems)
        num_chunks = (total + CHUNK_SIZE - 1) // CHUNK_SIZE

        for i in range(num_chunks):
            start = i * CHUNK_SIZE
            end = min(start + CHUNK_SIZE, total)
            chunk_items = problems[start:end]

            # 提取 min/max pid
            min_pid = chunk_items[0][1]
            max_pid = chunk_items[-1][1]

            filename = f"luogu_problems_{ptype.lower()}_{i:03d}.ndjson"
            filepath = os.path.join(OUTPUT_DIR, filename)

            # 写入分块文件
            with open(filepath, 'w', encoding='utf-8') as out:
                for _, _, prob in chunk_items:
                    out.write(json.dumps(prob, ensure_ascii=False) + "\n")

            chunks.append({
                "file": filename,
                "min_pid": min_pid,
                "max_pid": max_pid,
                "count": len(chunk_items)
            })

            print(f"✅ 写入 {filename} ({len(chunk_items)} 题): {min_pid} ~ {max_pid}")

        index_data["types"][ptype] = chunks

    # 3. 保存索引
    with open("luogu_index.json", "w", encoding="utf-8") as idx_file:
        json.dump(index_data, idx_file, ensure_ascii=False, indent=2)

    print("\n🎉 重组完成！")
    print(f"- P 类题目: {len(problems_by_type['P'])} 题")
    print(f"- B 类题目: {len(problems_by_type['B'])} 题")
    print("- 索引已保存为 luogu_index.json")

if __name__ == "__main__":
    main()