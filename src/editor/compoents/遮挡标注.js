import * as THREE from 'three';

const STYLE_ID = 'occlusion-label-popup-v2-style';
const DEFAULT_IMAGE = 'https://z2586300277.github.io/site.png';

function ensurePopupStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .occlusion-popup {
            position: fixed;
            left: 0;
            top: 0;
            width: min(340px, calc(100vw - 24px));
            border-radius: 16px;
            background: linear-gradient(155deg, rgba(7, 16, 28, 0.96), rgba(10, 24, 40, 0.94));
            border: 1px solid rgba(111, 201, 255, 0.42);
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(145, 218, 255, 0.18);
            color: #eaf6ff;
            pointer-events: auto;
            z-index: 9999;
            display: none;
            opacity: 0;
            transform: translate(-50%, -6px) scale(0.96);
            transition: opacity 0.16s ease, transform 0.16s ease;
            backdrop-filter: blur(6px);
            font-family: PingFang SC, Microsoft YaHei, sans-serif;
            overflow: visible;
        }

        .occlusion-popup.is-visible {
            opacity: 1;
            transform: translate(-50%, -15px) scale(1);
        }

        .occlusion-popup-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 10px 12px 8px;
            border-bottom: 1px solid rgba(113, 195, 255, 0.16);
            background: linear-gradient(90deg, rgba(37, 111, 173, 0.16), rgba(41, 139, 201, 0.02));
            border-radius: 16px 16px 0 0;
        }

        .occlusion-popup-title-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .occlusion-popup-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #54d2ff;
            box-shadow: 0 0 10px rgba(84, 210, 255, 0.9);
            flex: 0 0 auto;
        }

        .occlusion-popup-title {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #c9ebff;
        }

        .occlusion-popup-close {
            border: none;
            background: transparent;
            color: #c6e9ff;
            font-size: 14px;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            opacity: 0.8;
            transition: opacity 0.15s ease;
        }

        .occlusion-popup-close:hover {
            opacity: 1;
        }

        .occlusion-popup-body {
            padding: 10px 12px 12px;
        }

        .occlusion-popup-name {
            font-size: 12px;
            font-weight: 600;
            color: #8fc8eb;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .occlusion-popup-grid {
            display: grid;
            grid-template-columns: 58px 1fr;
            row-gap: 4px;
            column-gap: 6px;
            margin-bottom: 8px;
            font-size: 12px;
        }

        .occlusion-popup-key {
            color: #7aa8c8;
        }

        .occlusion-popup-val {
            color: #d8eeff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .occlusion-popup-text {
            font-size: 12px;
            line-height: 1.6;
            color: #e4f4ff;
            word-break: break-word;
            background: rgba(16, 41, 66, 0.4);
            border: 1px solid rgba(118, 197, 253, 0.2);
            border-radius: 10px;
            padding: 8px 10px;
        }

        .occlusion-popup-tail {
            position: absolute;
            left: 50%;
            bottom: -7px;
            width: 12px;
            height: 12px;
            transform: translateX(-50%) rotate(45deg);
            background: rgba(7, 15, 25, 0.95);
            border-right: 1px solid rgba(112, 206, 255, 0.36);
            border-bottom: 1px solid rgba(112, 206, 255, 0.36);
        }
    `;

    document.head.appendChild(style);
}

function isInGroup(obj, group) {
    let current = obj;
    while (current) {
        if (current === group) return true;
        current = current.parent;
    }
    return false;
}

function createTitleTexture(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');

    const drawRoundRect = (x, y, w, h, r) => {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    };

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const redraw = label => {
        const t = String(label || '设备标注').slice(0, 20);
        const c = color || '#58d2ff';
        let fontSize = 112;
        const maxTextWidth = 540;

        while (fontSize > 78) {
            ctx.font = `700 ${fontSize}px "Microsoft YaHei", sans-serif`;
            if (ctx.measureText(t).width <= maxTextWidth) break;
            fontSize -= 2;
        }

        ctx.font = `700 ${fontSize}px "Microsoft YaHei", sans-serif`;
        const textW = ctx.measureText(t).width;
        const width = Math.min(660, Math.max(300, Math.round(textW + Math.max(90, fontSize * 0.85))));
        const barH = THREE.MathUtils.clamp(Math.round(fontSize * 1.14), 104, 132);
        const x = (canvas.width - width) / 2;
        const y = Math.round((canvas.height - barH) * 0.5);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 底部轻投影，让标题更稳重，不做外描边
        drawRoundRect(x + 6, y + 8, width - 12, barH - 8, 30);
        ctx.fillStyle = 'rgba(4, 11, 20, 0.34)';
        ctx.fill();

        drawRoundRect(x, y, width, barH, 34);
        const bg = ctx.createLinearGradient(0, y, 0, y + barH);
        bg.addColorStop(0, 'rgba(11, 29, 46, 0.9)');
        bg.addColorStop(1, 'rgba(5, 15, 27, 0.88)');
        ctx.fillStyle = bg;
        ctx.fill();

        drawRoundRect(x + 8, y + 6, width - 16, Math.max(24, Math.round(barH * 0.26)), 16);
        const hi = ctx.createLinearGradient(0, y, 0, y + barH * 0.35);
        hi.addColorStop(0, `${c}55`);
        hi.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hi;
        ctx.fill();

        ctx.shadowColor = `${c}4d`;
        ctx.shadowBlur = 9;
        ctx.lineWidth = Math.max(5, Math.round(fontSize * 0.08));
        ctx.strokeStyle = 'rgba(7, 26, 44, 0.95)';
        ctx.fillStyle = '#f7fcff';
        ctx.font = `700 ${fontSize}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textY = y + barH * 0.535;
        ctx.strokeText(t, canvas.width / 2, textY);
        ctx.fillText(t, canvas.width / 2, textY);

        texture.needsUpdate = true;

        return {
            widthRatio: width / canvas.width,
            aspect: barH / width
        };
    };

    const initialLayout = redraw(text);
    return { texture, redraw, initialLayout };
}

function createPopupElement() {
    const popup = document.createElement('div');
    popup.className = 'occlusion-popup';

    popup.innerHTML = `
        <div class="occlusion-popup-head">
            <div class="occlusion-popup-title-wrap">
                <span class="occlusion-popup-dot"></span>
                <span class="occlusion-popup-title">标注详情</span>
            </div>
            <button id="occlusionPopupClose" class="occlusion-popup-close">✕</button>
        </div>
        <div class="occlusion-popup-body">
            <div id="occlusionPopupName" class="occlusion-popup-name"></div>
            <div class="occlusion-popup-grid">
                <span class="occlusion-popup-key">区域</span><span id="occlusionPopupArea" class="occlusion-popup-val"></span>
                <span class="occlusion-popup-key">状态</span><span id="occlusionPopupStatus" class="occlusion-popup-val"></span>
                <span class="occlusion-popup-key">负责人</span><span id="occlusionPopupOwner" class="occlusion-popup-val"></span>
                <span class="occlusion-popup-key">更新时间</span><span id="occlusionPopupUpdated" class="occlusion-popup-val"></span>
            </div>
            <div id="occlusionPopupText" class="occlusion-popup-text"></div>
        </div>
        <div class="occlusion-popup-tail"></div>
    `;

    document.body.appendChild(popup);
    return popup;
}

export default {
    name: '遮挡标注',
    label: '遮挡标注',

    create(storage, { scene, camera, renderer, transformControls }) {
        ensurePopupStyle();

        const params = {
            text: storage?.text || '设备' + Math.floor(Math.random() * 1000),
            info: storage?.info || '该点位正在持续监测中，当前画面稳定，建议每 30 分钟进行一次巡检确认。',
            area: storage?.area || 'A区机房-东走廊',
            status: storage?.status || '在线',
            owner: storage?.owner || '值班员 张工',
            updatedAt: storage?.updatedAt || new Date().toLocaleString('zh-CN', { hour12: false }),
            imgSrc: storage?.imgSrc || DEFAULT_IMAGE,
            iconScale: THREE.MathUtils.clamp(storage?.iconScale ?? 0.92, 0.55, 1.2),
            titleScale: THREE.MathUtils.clamp(storage?.titleScale ?? 1.62, 1.15, 2.15),
            titleColor: storage?.titleColor || '#58d2ff'
        };

        const group = new THREE.Group();
        group.name = String(storage?.name || params.text);
        params.text = group.name;

        const { texture: titleTexture, redraw: redrawTitle, initialLayout } = createTitleTexture(params.text, params.titleColor);
        let titleLayout = initialLayout;
        const titleMaterial = new THREE.SpriteMaterial({
            map: titleTexture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            alphaTest: 0.05
        });
        const titleSprite = new THREE.Sprite(titleMaterial);
        titleSprite.name = 'occlusionLabelTitle';
        group.add(titleSprite);

        let iconTexture;
        const iconLoader = new THREE.TextureLoader();
        const iconMaterial = new THREE.SpriteMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: false,
            alphaTest: 0.05
        });

        const iconSprite = new THREE.Sprite(iconMaterial);
        iconSprite.name = 'occlusionLabelIcon';
        group.add(iconSprite);

        const updateSpriteLayout = () => {
            const widthBoost = THREE.MathUtils.clamp(0.86 + titleLayout.widthRatio * 0.95, 1.05, 1.72);
            const titleX = THREE.MathUtils.clamp(params.titleScale * widthBoost, 1.35, 2.8);
            const titleY = THREE.MathUtils.clamp(titleX * titleLayout.aspect, 0.52, 0.98);
            titleSprite.scale.set(titleX, titleY, 1);

            let iconW = params.iconScale;
            let iconH = params.iconScale;
            const img = iconTexture?.image;
            if (img?.width && img?.height) {
                const aspect = img.width / img.height;
                const maxH = params.iconScale;
                const maxW = params.iconScale * 1.18;
                iconW = maxW;
                iconH = iconW / aspect;
                if (iconH > maxH) {
                    iconH = maxH;
                    iconW = iconH * aspect;
                }
            }

            iconSprite.scale.set(iconW, iconH, 1);
            titleSprite.position.y = iconH * 0.5 + titleY * 0.5 + Math.max(0.08, iconH * 0.08);
        };

        iconTexture = iconLoader.load(
            params.imgSrc,
            () => {
                iconTexture.colorSpace = THREE.SRGBColorSpace;
                iconMaterial.map = iconTexture;
                iconMaterial.needsUpdate = true;
                updateSpriteLayout();
            },
            undefined,
            () => {
                if (params.imgSrc !== DEFAULT_IMAGE) {
                    iconTexture = iconLoader.load(DEFAULT_IMAGE, () => {
                        iconTexture.colorSpace = THREE.SRGBColorSpace;
                        iconMaterial.map = iconTexture;
                        iconMaterial.needsUpdate = true;
                        updateSpriteLayout();
                    });
                }
            }
        );
        iconTexture.colorSpace = THREE.SRGBColorSpace;
        iconMaterial.map = iconTexture;
        iconMaterial.needsUpdate = true;
        updateSpriteLayout();

        const popup = createPopupElement();
        const popupName = popup.querySelector('#occlusionPopupName');
        const popupArea = popup.querySelector('#occlusionPopupArea');
        const popupStatus = popup.querySelector('#occlusionPopupStatus');
        const popupOwner = popup.querySelector('#occlusionPopupOwner');
        const popupUpdated = popup.querySelector('#occlusionPopupUpdated');
        const popupText = popup.querySelector('#occlusionPopupText');
        const popupClose = popup.querySelector('#occlusionPopupClose');

        let popupVisible = false;
        let hideTimer = null;
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const worldPos = new THREE.Vector3();

        const setPopupText = () => {
            const currentName = String(group.name || params.text);
            params.text = currentName;
            titleLayout = redrawTitle(currentName);
            updateSpriteLayout();
            popupName.textContent = currentName;
            popupArea.textContent = params.area;
            popupStatus.textContent = params.status;
            popupOwner.textContent = params.owner;
            popupUpdated.textContent = params.updatedAt;
            popupText.textContent = params.info;
        };

        const updatePopupPosition = () => {
            if (!popupVisible || !camera) return;

            iconSprite.getWorldPosition(worldPos);
            worldPos.project(camera);

            const isOut = worldPos.z < -1 || worldPos.z > 1;
            if (isOut) {
                popup.style.display = 'none';
                return;
            }

            const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;

            popup.style.left = `${x}px`;
            popup.style.top = `${y}px`;
            const rect = popup.getBoundingClientRect();
            const margin = 12;
            const clampedX = Math.min(window.innerWidth - margin - rect.width / 2, Math.max(margin + rect.width / 2, x));
            const clampedY = Math.min(window.innerHeight - margin, Math.max(margin + rect.height, y));

            popup.style.left = `${clampedX}px`;
            popup.style.top = `${clampedY}px`;
            popup.style.display = 'block';
        };

        const showPopup = () => {
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            setPopupText();
            popupVisible = true;
            popup.style.display = 'block';
            updatePopupPosition();
            requestAnimationFrame(() => popup.classList.add('is-visible'));
        };

        const hidePopup = () => {
            popupVisible = false;
            popup.classList.remove('is-visible');
            if (hideTimer) {
                clearTimeout(hideTimer);
            }
            hideTimer = setTimeout(() => {
                if (!popupVisible) {
                    popup.style.display = 'none';
                }
            }, 180);
        };

        const onPointerDown = event => {
            if (!renderer?.domElement || !camera || !scene) return;

            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(scene.children, true);
            if (!hits.length) {
                hidePopup();
                return;
            }

            if (isInGroup(hits[0].object, group)) {
                showPopup();
            } else {
                hidePopup();
            }
        };

        const onDoubleClick = event => {
            if (!renderer?.domElement || !camera || !scene) return;

            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(scene.children, true);
            if (hits.length && isInGroup(hits[0].object, group)) {
                transformControls?.attach?.(group);
            }
        };

        renderer?.domElement?.addEventListener('pointerdown', onPointerDown);
        renderer?.domElement?.addEventListener('dblclick', onDoubleClick);
        popupClose?.addEventListener('click', event => {
            event.stopPropagation();
            hidePopup();
        });

        iconSprite.onBeforeRender = () => {
            if (popupVisible) updatePopupPosition();
        };

        const cleanup = () => {
            renderer?.domElement?.removeEventListener('pointerdown', onPointerDown);
            renderer?.domElement?.removeEventListener('dblclick', onDoubleClick);
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            popupVisible = false;
            popup.classList.remove('is-visible');
            popup.style.display = 'none';
            iconSprite.onBeforeRender = null;
            popup.remove();
            titleTexture.dispose();
            titleMaterial.dispose();
            iconTexture.dispose();
            iconMaterial.dispose();
        };

        group.userData.params = params;
        group.REMOVECALL = cleanup;
        group.userData.dispose = cleanup;

        return group;
    },

    getStorage(mesh) {
        const params = mesh.userData.params || {};
        return {
            ...params,
            text: mesh.name || params.text
        };
    }
};
