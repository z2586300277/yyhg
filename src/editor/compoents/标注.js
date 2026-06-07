import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const LEGACY_DEVICE_IMAGE = 'https://z2586300277.github.io/three-cesium-examples/files/author/z2586300277.png';

function getDeviceIconMarkup(imgSrc) {
    if (imgSrc && imgSrc !== LEGACY_DEVICE_IMAGE) {
        return `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:scale-down; display:block; margin:0 auto;">`;
    }

    return `
        <div style="position:relative; width:44px; height:44px; display:flex; justify-content:center; align-items:center;">
            <div style="position:absolute; inset:-3px; border-radius:14px; border:1px solid rgba(106, 190, 255, 0.34); box-shadow:0 0 16px rgba(94, 172, 255, 0.2);"></div>
            <div style="position:relative; width:40px; height:40px; border-radius:12px; background:linear-gradient(160deg, rgba(243, 250, 255, 0.98), rgba(123, 197, 255, 0.96) 58%, rgba(32, 82, 136, 0.96)); border:1px solid rgba(220, 240, 255, 0.68); box-shadow:0 8px 18px rgba(27, 63, 108, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.6); display:flex; justify-content:center; align-items:center;">
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                    <rect x="11" y="9" width="30" height="26" rx="5" fill="#123252" />
                    <rect x="15" y="14" width="14" height="8" rx="2" fill="#8FE6FF" />
                    <circle cx="34.5" cy="18" r="2.4" fill="#89D7FF" />
                    <circle cx="34.5" cy="25" r="2.4" fill="#6CFFBE" />
                    <path d="M16 29H29" stroke="#DDF5FF" stroke-width="2.5" stroke-linecap="round" />
                    <path d="M15 39H37" stroke="#DDF5FF" stroke-width="3" stroke-linecap="round" />
                    <path d="M21 35V39" stroke="#DDF5FF" stroke-width="3" stroke-linecap="round" />
                    <path d="M31 35V39" stroke="#DDF5FF" stroke-width="3" stroke-linecap="round" />
                </svg>
            </div>
        </div>
    `;
}

// 导出组件定义
export default {
    name: '标注',
    label: '标注',

    // 创建组件
    create: function (storage, { transformControls }) {
        // 初始参数
        const params = {
            text: storage?.text || '设备' + Math.floor(Math.random() * 1000), // 默认文本，随机编号
            fontSize: storage?.fontSize || '18px',
            color: storage?.color || '#bedfff',
            bold: storage?.bold || 'normal',
            status: storage?.status || '在线',
            deviceNo: storage?.deviceNo || ('DEV-' + Math.floor(Math.random() * 9000 + 1000)),
            location: storage?.location || 'A区机房',
            owner: storage?.owner || '运维组',
            imgSrc: storage?.imgSrc || ''
        };
        
        // 创建根容器
        const container = document.createElement("div");
        container.style.position = "relative";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.style.textAlign = "center";
        container.style.gap = "6px";
        
        // 简单2D标注：上方文字，下方图片
        container.innerHTML = `
            <div id="textDisplay" style="text-align:center; pointer-events:auto; cursor:pointer; user-select:none;">
                <span id="textSpan" style="font-size:${params.fontSize}; color:${params.color}; font-weight:${params.bold};">
                    ${params.text}
                </span>
            </div>

            <div id="imgContainer" style="pointer-events:auto; width:40px; height:40px; cursor:pointer; display:flex; justify-content:center; align-items:center; margin:0 auto;">
                ${getDeviceIconMarkup(params.imgSrc)}
            </div>

            <div id="devicePopup" style="position:absolute; left:50%; bottom:52px; transform:translate(-50%, 0px); width:216px; padding:10px 12px; border-radius:12px; background:linear-gradient(145deg, rgba(15, 30, 52, 0.96), rgba(8, 14, 25, 0.95)); border:1px solid rgba(118, 182, 255, 0.45); box-shadow:0 12px 26px rgba(0, 0, 0, 0.38), inset 0 0 16px rgba(93, 169, 255, 0.15); backdrop-filter:blur(6px); text-align:left; color:#e6f3ff; pointer-events:auto; z-index:10; display:none; opacity:0; transition:opacity .18s ease, transform .18s ease;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:13px; font-weight:700; color:#9fd4ff;">设备信息</span>
                    <button id="popupClose" style="pointer-events:auto; border:none; background:transparent; color:#bcdfff; font-size:14px; cursor:pointer; padding:0 2px;">✕</button>
                </div>
                <div style="display:grid; grid-template-columns:54px 1fr; row-gap:4px; column-gap:6px; font-size:12px; line-height:1.35;">
                    <span style="color:#8caed0;">名称</span><span id="popupName" style="color:#ffffff;"></span>
                    <span style="color:#8caed0;">编号</span><span id="popupNo" style="color:#d7ecff;">${params.deviceNo}</span>
                    <span style="color:#8caed0;">状态</span><span id="popupStatus" style="color:#79f2ad;">${params.status}</span>
                    <span style="color:#8caed0;">位置</span><span id="popupLocation" style="color:#d7ecff;">${params.location}</span>
                    <span style="color:#8caed0;">负责人</span><span id="popupOwner" style="color:#d7ecff;">${params.owner}</span>
                </div>
                <div style="position:absolute; left:50%; bottom:-6px; width:12px; height:12px; transform:translateX(-50%) rotate(45deg); background:rgba(9, 16, 28, 0.95); border-right:1px solid rgba(118, 182, 255, 0.45); border-bottom:1px solid rgba(118, 182, 255, 0.45);"></div>
            </div>
        `;
        
        // 获取DOM元素引用
        const textDisplay = container.querySelector('#textDisplay');
        const textSpan = container.querySelector('#textSpan');
        const imgContainer = container.querySelector('#imgContainer');
        const devicePopup = container.querySelector('#devicePopup');
        const popupName = container.querySelector('#popupName');
        const popupStatus = container.querySelector('#popupStatus');
        const popupClose = container.querySelector('#popupClose');
        
        // 构建CSS2D对象
        const mesh = new CSS2DObject(container);

        // 文本与 mesh.name 同步
        mesh.name = String(storage?.name || params.text);
        params.text = mesh.name;
        textSpan.textContent = mesh.name;
        
        // 存储参数
        mesh.userData.params = params;

        let popupVisible = false;
        let clickTimer = null;

        const showPopup = () => {
            const name = String(mesh.name || params.text);
            params.text = name;
            textSpan.textContent = name;
            popupName.textContent = name;
            popupStatus.textContent = params.status;
            popupVisible = true;
            devicePopup.style.display = 'block';
            requestAnimationFrame(() => {
                devicePopup.style.opacity = '1';
                devicePopup.style.transform = 'translate(-50%, -8px)';
            });
        };

        const hidePopup = () => {
            popupVisible = false;
            devicePopup.style.opacity = '0';
            devicePopup.style.transform = 'translate(-50%, 0px)';
            setTimeout(() => {
                if (!popupVisible) {
                    devicePopup.style.display = 'none';
                }
            }, 180);
        };

        const bindMarkerEvents = target => {
            target.addEventListener('click', event => {
                event.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }
                clickTimer = setTimeout(() => {
                    showPopup();
                    clickTimer = null;
                }, 220);
            });

            target.addEventListener('dblclick', event => {
                event.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                hidePopup();
                transformControls?.attach?.(mesh);
            });
        };
        
        bindMarkerEvents(textDisplay);
        bindMarkerEvents(imgContainer);

        popupClose.addEventListener('click', event => {
            event.stopPropagation();
            hidePopup();
        });
        
        return mesh;
    },
    
    // 获取存储数据
    getStorage: function(mesh) {
        const params = mesh.userData.params || {};
        return { ...params, text: mesh.name || params.text };
    },
};
