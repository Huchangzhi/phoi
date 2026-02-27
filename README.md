# PH code(原名phoi)

一个适合oi的在线c++编辑器，甚至可以在手机上写代码

UI参考：Microsofr VS Code ~~（微软大战代码）~~ ，部分图标来自VScode，CPH

运行器：[rextester](https://rextester.com/)

体验:[点我](https://hcz1017.pythonanywhere.com/)

另外,ph code桌面版自v2.2.2版本已打包发布至release
运行要求:

**关于桌面版**

环境要求:

> win10及以上   

> webview2 

安装：

Release里面下载（推荐2.2.5+，不建议beta版本）

功能区别:

gdb调试，但是翻译功能仍是使用云端接口

---

插件功能：

> 目前插件功能正在改善，正在添加更多的端口，希望大家多多pr

> 目前插件：C++代码补全，洛谷主题库查看，CPH测试点维护


注：洛谷题目来自https://cdn.luogu.com.cn/problemset-open/latest.ndjson.gz

部署:
```sh
pip install -r requirements.txt
```
对于使用rextester的
```sh
python app.py
```
对于使用本机进行评测的（有风险，建议容器内部署）
```sh
python app_local.py
```

gui版本
```sh
python server_gui.py
```