# 虚拟歌手立绘烘焙

白底立绘在素材维护阶段提前去底，生成带 Alpha 通道的透明无损 WebP。浏览器和前端构建均不执行抠图；详情、列表和搜索直接读取已提交的静态成品。脚本为 [bake-vocal-backgrounds.py](../../frontend/scripts/bake-vocal-backgrounds.py)，只依赖 Python 与 Pillow，不使用分割模型或外部图像服务。

## 原图与成品

文件统一放在 `frontend/public/vocals/`：

- 原图保留为 `<name>-raw.<原扩展名>`，作为后续重新烘焙的唯一输入，不用成品反复加工。
- 成品使用 `<name>.webp`，保持原图像素尺寸，不缩放、不裁剪。`lossless=True` 避免烘焙后再引入有损压缩；原图已有的压缩损失不会因此恢复。
- 角色配置中的 `image_path` 指向成品；`/public/vocals/` 会规范化为浏览器实际使用的 `/vocals/`。搜索配置中的 `image` 同样指向成品，不引用 `*-raw`。

当前已烘焙言和（`yanhe`）、乐正绫（`yuezhengling`）、乐正龙牙（`yuezhenglongya`）、徵羽摩柯（`zhiyunmoke`）、墨清弦（`moqingxian`）和星尘（`xingchen`）。星尘原图为 `xingchen-raw.jpg`，其余五张原图为 WebP。

已有透明背景的素材不重新烘焙。判断依据是解码后的实际 Alpha 值，不能仅看 PNG / WebP 后缀或是否为 RGBA：初音未来的 PNG 使用调色板透明信息，转换为 RGBA 后同样能读出透明度。脚本若收到任一 Alpha 小于 255 的输入会报错中止，避免将原有透明度压平；默认只处理 `JOBS` 名单，不扫描和改写整个素材目录。

## 去底过程

1. **识别近白色候选。** 当前固定背景为白色，`TOLERANCE = 20`，即 R、G、B 三个通道都不低于 235 才可进入背景填充。并非所有近白色像素都会被删除。
2. **填充连通背景。** 从图片四周及 `JOBS[name].seeds` 中的起点，沿上、下、左、右四邻域扩展，仅将连通的近白色区域设为透明。封闭在发丝、飘带或双腿之间的背景，需要逐图确认后补充起点。起点会检查是否越界、是否为近白色。
3. **保留印章白字。** 禾念橙色印章的白字可能与外部白底连通。在配置的 `white_ink_region` 内，逐行查找颜色通道差大于 80 的彩色像素，保留其左右边缘之间的内容，避免把白字一起删掉。这是针对现有橙色印章的局部规则，不是通用文字识别。
4. **处理细白边。** 只在透明背景周围的两像素边缘带中，参考邻近较深像素估计透明度，并扣除原先混入的白色。未选中的近白区域保留原色和不透明度，远离边缘的内容不参与这一修正。透明背景像素保存为 RGBA `(0, 0, 0, 0)`。
5. **输出静态成品。** 生成透明无损 WebP，不更改 `*-raw`，不主动删除 Logo、水印或其他独立图形。重新运行会覆盖同名成品，更新配置后可从原图重新生成。

这一方法依赖背景与角色轮廓的颜色和连通关系。白衣服、浅色头发、皮肤高光即使与背景同色，也可能属于角色；不能直接将所有白色删除。轮廓缺口可能让填充进入角色内部，封闭背景也可能留白，因此新增素材仍需逐图检查。当前机制仅针对近白色背景，不自动处理其他纯色或复杂场景背景。

## 重新烘焙

以下命令在仓库根目录执行；Pillow 仅用于素材维护，不加入前端运行依赖或构建流程。使用临时虚拟环境可避免修改系统 Python：

```bash
python3 -m venv /tmp/hantang-vocal-bake-venv
/tmp/hantang-vocal-bake-venv/bin/python -m pip install Pillow
/tmp/hantang-vocal-bake-venv/bin/python frontend/scripts/bake-vocal-backgrounds.py
```

不传名称会重新生成全部六张；也可按 `JOBS` 的键选择部分素材：

```bash
/tmp/hantang-vocal-bake-venv/bin/python frontend/scripts/bake-vocal-backgrounds.py yanhe moqingxian
```

## 新增或替换素材

1. 检查实际 Alpha；已有透明区域的原图直接沿用。对白底不透明素材，先保留同名 `*-raw` 原图。
2. 在 `JOBS` 中配置 `raw` 与 `seeds`。坐标使用原图像素，以左上角为 `(0, 0)`，x 向右、y 向下；没有封闭背景空隙时使用空列表。
3. 对类似的橙色印章可配置 `white_ink_region`，格式为 `(left, top, right, bottom)`，右、下边界不包含在区域内。该规则仅在明确的印章范围内启用。
4. 单独运行该素材，检查浅色和深色背景下的成品，再按需调整起点。特别检查白衣服、脸部、皮肤高光、浅发、发丝空隙、飘带和角落标识；不能用肤色高光作为背景起点。替换原图或改变尺寸后，重新核对全部坐标。
5. 若成品路径变化，同步更新 [详情 / 列表配置](../../frontend/src/constants/vocal/vocal-frontend-info.json) 与 [搜索配置](../../frontend/src/constants/vocal/vocal-search-info.json)，以及现有测试中的路径断言。一起提交原图、成品、脚本配置和必要说明。

## 验证

核对原图的文件校验和未变化、成品尺寸与原图一致、成品具有实际透明像素；未处理的透明素材应保持文件字节不变。脚本重复生成应始终以 `*-raw` 为输入。

前端检查在 `frontend/` 目录执行 `npm test` 和 `npm run build`。现有测试验证编号与素材路径，不代表已自动检查抠图质量；深浅底下的边缘及角色内容完整性仍需人工检查。页面入口为 `/vocals`，六张烘焙立绘的详情编号为 102、103、104、105、106、301，页面约定见[虚拟歌手详情](vocal-detail.md)。
