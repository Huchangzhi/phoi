# PH code(原名phoi)

> 本项目完全使用vibe code，仅供学习，造成损失作者概不负责

一个适合oi的在线c++编辑器，甚至可以在手机上写代码

UI参考：Microsofr VS Code ~~（微软大战代码）~~ ，部分图标来自VScode，CPH

运行器：[rextester](https://rextester.com/)

体验:

[主站](https://ide.hcz1017.dpdns.org/)

[备用](https://hcz1017.pythonanywhere.com/)


## 为什么暂缓开发

最近学习压力很大，再加上功能已经基本完整，于是决定暂缓开发，若有问题请邮箱联系：hcz1017@outlook.com

目前不知道多久恢复开发





另外,ph code桌面版自v2.2.2版本已打包发布至release
运行要求:

**关于桌面版**

环境要求:

> win10及以上   

> [webview2](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2)

安装：

Release里面下载

功能区别:

gdb调试，但是翻译功能仍是使用云端接口

cph浏览器插件传送数据至phcode

端口使用:27120(主程序)，27121(cph)



---

插件功能：

> 目前插件功能正在改善，正在添加更多的端口，希望大家多多pr

> 目前插件：C++代码补全，洛谷主题库查看，CPH测试点维护


注：洛谷题目来自https://cdn.luogu.com.cn/problemset-open/latest.ndjson.gz

## 部署:
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

cloudflare部署:

1.克隆此仓库
2.在cloudflare workers里面选择克隆的仓库创建worker
3.配置
<img width="441" height="82" alt="image" src="https://github.com/user-attachments/assets/0ba5e98c-6792-4866-b1e9-265126010664" />

<img width="594" height="1202" alt="image" src="https://github.com/user-attachments/assets/ba53f0ad-a8cb-4ac0-a4d2-06b6428534f3" />

