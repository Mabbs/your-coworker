# waifu-widget · 网站看板娘（独立组件包）

由 [Mabbs/your-coworker](https://github.com/Mabbs/your-coworker) 改造而来的**自包含**网页看板娘组件：Spine 4.3 坐姿办公同事，可悬浮在任意网页上随意拖动，带完整换装、视线跟随与键鼠联动。

## 包结构

```
waifu-widget/
├── waifu-widget.js     组件本体（零构建，宿主页面一行 <script> 嵌入）
├── waifu-widget.css    组件样式（.ycw- 前缀隔离 + all:initial 阻断宿主页样式）
├── costume.js          换装规则（精简自原项目，ItemTable 驱动）
├── demo.html           演示页（模拟普通博客）
├── vendor/spine-webgl.min.js   Spine 4.3 运行时
├── models/PoseA/               角色模型（atlas / skel / WebP 贴图）
├── models/DefaultDesk/         办公桌场景模型（椅子 / 桌体 / 电脑，WebP 贴图）
└── data/                       items.json + item-text.json（换装数据）
```

整个目录拷贝到任意静态目录或 CDN 即可使用，与原项目零依赖。

## 快速开始

需要通过 HTTP 服务访问（`file://` 下 `fetch` 模型资源会被浏览器拦截）：

```bash
cd waifu-widget
python -m http.server 8000
# 或 npx serve .
```

打开 <http://127.0.0.1:8000/demo.html>。

## 嵌入你的网站

组件会按需自动加载 Spine 运行时、换装服务和样式，资源默认相对本包目录解析：

```html
<script src="/path/to/waifu-widget/waifu-widget.js" data-ycw-auto defer></script>
```

或手动挂载自定义参数：

```html
<script src="/path/to/waifu-widget/waifu-widget.js" defer></script>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    WaifuWidget.mount({
      base: '/path/to/waifu-widget/', // 资源根目录（默认：组件所在目录）
      width: 300,                      // 角色显示宽度 px
      x: 40, y: 400                    // 初始位置（默认左下角）
    });
  });
</script>
```

编程接口：

```js
WaifuWidget.mount();          // 挂载（单例）
WaifuWidget.unmount();        // 卸载并清理全部监听
const w = WaifuWidget.instance;
w.randomizeOutfit();          // 随机穿搭
w.resetOutfit();              // 恢复初始穿搭
w.togglePanel(true);          // 打开/关闭换装间
w.setScale(1.2);              // 缩放
w.hide(); w.show();           // 收起 / 召回
w.say('自定义对话', 3000);     // 气泡
```

## 功能说明

- **随意拖动**：画布 `pointer-events: none`，组件在 `window` 捕获阶段用 `gl.readPixels` 做逐像素透明命中——只有点到角色身上的不透明像素才接管拖拽，其余点击完全穿透；拖拽时速度驱动骨架小幅位移，头发 / 尾巴物理飘动。
- **换装系统**：头饰 / 面饰 / 套装 / 上衣 / 下装 / 腿部 / 尾巴 / 道具，含中文名称、稀有度标签、套装覆盖规则（穿上套装自动锁定上下装）；ItemTable 加载失败时自动退化为皮肤名扫描模式。
- **视线跟随**：头部（±11°）与瞳孔（经 EyeBall 约束驱动）跟随鼠标移动，平滑转向、指针离开页面回正；头部转动时睫毛不额外滑动（HeadAngle→EyeR/EyeL 约束平移混合已清零）。
- **键鼠联动**：页面打字 → 打字动作，点击 → 点鼠标动作（连续输入不重启，点击角色本体不受影响）。
- **办公桌场景**：🖥️ 按钮开关办公桌。桌子部件（桌体 / 电脑 / 鼠标 / 台灯 / 果汁 / 盆栽）画在角色前面，形成"坐在桌后"构图；以桌子的椅子槽位对齐角色骨架自带的 Chair_01/02/03 椅子（桌侧椅子隐藏避免重复）；点桌子像素同样整体拖拽，状态持久化。
- **动画分层**：待机呼吸（轨道 0）+ 眨眼表情（Mood/Default，轨道 1）+ 一次性动作（轨道 2）+ 尾巴循环（轨道 3）并行不冲突；情绪装饰（脸红等）播完自动摘除。
- **持久化**：位置 / 缩放 / 穿搭保存在 `localStorage`（键 `ycw:state:v1`）。
- **健壮性**：WebGL 上下文丢失时自动重建画布重试；模型加载 30s 超时看门狗。

## 已知限制

- 需 HTTPS 或 localhost 环境（WebGL + fetch）。
- 面向桌面与现代移动浏览器；`file://` 协议不可用。
- 视线 / 眨眼 / 换装控制点按 PoseA 骨骼命名硬编码，其他模型缺失对应骨骼时对应功能自动关闭。

## 来源与致谢

- 模型与换装数据：[Mabbs/your-coworker](https://github.com/Mabbs/your-coworker)（Spine 4.3 解包资源 + 游戏 ItemTable）
- 渲染运行时：spine-webgl 4.3
