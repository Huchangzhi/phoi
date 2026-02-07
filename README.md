# PH code(原名phoi)

一个适合oi的在线c++编辑器，甚至可以在手机上写代码

UI参考：Microsofr VS Code ~~（微软大战代码）~~ ，部分图标来自VScode，CPH

运行器：[rextester](https://rextester.com/)

体验:[点我](https://hcz1017.pythonanywhere.com/)

插件功能：

> 目前插件功能正在改善，正在添加更多的端口，希望大家多多pr

> 目前插件：C++代码补全，洛谷主题库查看，CPH测试点维护


注：洛谷题目来自https://cdn.luogu.com.cn/problemset-open/latest.ndjson.gz

部署:
```sh
pip install flask
```
对于使用rextester的
```sh
python app.py
```
对于使用本机进行评测的（有风险，建议容器内部署）
```sh
python app_local.py
```
