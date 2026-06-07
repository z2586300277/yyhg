import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const STYLE_ID = 'monitor-widget-style';

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes monitorPulse {
            0% { transform: scale(0.86); opacity: 0.85; }
            70% { transform: scale(1.2); opacity: 0; }
            100% { transform: scale(1.2); opacity: 0; }
        }
    `;

    document.head.appendChild(style);
}

export default {
    name: '监控组件',
    label: '监控组件',

    create: function (storage, { transformControls }) {
        ensureStyle();

        const params = {
            text: storage?.text || '摄像头' + randomInt(100, 999),
            fontSize: storage?.fontSize || '16px',
            color: storage?.color || '#d6ecff',
            bold: storage?.bold || 'normal',
            videoSrc: storage?.videoSrc || 'https://z2586300277.github.io/3d-file-server/video/test.mp4',
            poster: storage?.poster || '',
            info: storage?.info || '实时监控视频预览'
        };

        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.overflow = 'visible';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.textAlign = 'center';
        container.style.gap = '6px';
        container.style.setProperty('--monitor-color', '#6eb9ff');

        container.innerHTML = `
            <div id="textDisplay" style="text-align:center; pointer-events:auto; cursor:pointer; user-select:none;">
                <span id="textSpan" style="font-size:${params.fontSize}; color:${params.color}; font-weight:${params.bold}; text-shadow:0 0 10px rgba(110, 185, 255, 0.28);"></span>
            </div>

            <div id="cameraMarker" style="position:relative; pointer-events:auto; width:44px; height:44px; cursor:pointer; display:flex; justify-content:center; align-items:center; margin:0 auto;">
                <div style="position:absolute; inset:-4px; border:1px solid rgba(110, 185, 255, 0.65); border-radius:50%; animation:monitorPulse 1.5s ease-out infinite;"></div>
                <div style="position:relative; z-index:1; width:36px; height:36px; border-radius:50%; background:radial-gradient(circle at 30% 28%, #f4fbff, #6eb9ff); box-shadow:0 0 16px rgba(110, 185, 255, 0.56); display:flex; justify-content:center; align-items:center;">
                    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
                        <rect x="5" y="10" width="16" height="12" rx="2.2" fill="#10273f" />
                        <path d="M21 14L27 11V21L21 18V14Z" fill="#10273f" />
                        <circle cx="13" cy="16" r="3.2" fill="#7dd8ff" />
                    </svg>
                </div>
            </div>

            <div id="monitorPopup" style="position:absolute; left:50%; top:calc(100% + 12px); transform:translate(-50%, 8px); width:248px; padding:10px 12px; border-radius:12px; background:linear-gradient(145deg, rgba(14, 29, 47, 0.96), rgba(8, 17, 28, 0.95)); border:1px solid rgba(110, 185, 255, 0.42); box-shadow:0 12px 30px rgba(0, 0, 0, 0.42), inset 0 0 18px rgba(90, 167, 255, 0.14); backdrop-filter:blur(6px); text-align:left; color:#eaf5ff; pointer-events:auto; z-index:10; display:none; opacity:0; transition:opacity .18s ease, transform .18s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:13px; font-weight:700; color:#98d0ff;">监控视频信息</span>
                    <button id="popupClose" style="pointer-events:auto; border:none; background:transparent; color:#cbe6ff; font-size:14px; cursor:pointer; padding:0 2px;">✕</button>
                </div>

                <div style="position:relative; width:100%; height:136px; margin-bottom:9px; border-radius:10px; overflow:hidden; background:linear-gradient(145deg, rgba(5, 12, 20, 0.94), rgba(11, 24, 39, 0.94)); border:1px solid rgba(121, 191, 255, 0.3);">
                    <video id="popupVideo" src="${params.videoSrc}" ${params.poster ? `poster="${params.poster}"` : ''} controls muted playsinline loop preload="metadata" style="width:100%; height:100%; object-fit:cover; background:#03080f;"></video>
                </div>

                <div id="popupInfo" style="font-size:12px; color:#d9edff; line-height:1.35; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>

                <div style="position:absolute; left:50%; top:-6px; width:12px; height:12px; transform:translateX(-50%) rotate(45deg); background:rgba(11, 22, 35, 0.95); border-left:1px solid rgba(110, 185, 255, 0.42); border-top:1px solid rgba(110, 185, 255, 0.42);"></div>
            </div>
        `;

        const textDisplay = container.querySelector('#textDisplay');
        const textSpan = container.querySelector('#textSpan');
        const cameraMarker = container.querySelector('#cameraMarker');
        const monitorPopup = container.querySelector('#monitorPopup');
        const popupClose = container.querySelector('#popupClose');
        const popupVideo = container.querySelector('#popupVideo');
        const popupInfo = container.querySelector('#popupInfo');

        const mesh = new CSS2DObject(container);
        mesh.name = String(storage?.name || params.text);
        params.text = mesh.name;

        const syncName = () => {
            const name = String(mesh.name || params.text);
            params.text = name;
            textSpan.textContent = name;
            popupInfo.textContent = `${name}：${params.info}`;
        };

        let popupVisible = false;
        let clickTimer = null;

        const showPopup = () => {
            syncName();
            popupVisible = true;
            monitorPopup.style.display = 'block';

            if (popupVideo.getAttribute('src') !== params.videoSrc) {
                popupVideo.setAttribute('src', params.videoSrc);
            }

            popupVideo.currentTime = 0;
            const playPromise = popupVideo.play();
            if (playPromise?.catch) playPromise.catch(() => {});

            requestAnimationFrame(() => {
                monitorPopup.style.opacity = '1';
                monitorPopup.style.transform = 'translate(-50%, 0px)';
            });
        };

        const hidePopup = () => {
            popupVisible = false;
            popupVideo.pause();
            monitorPopup.style.opacity = '0';
            monitorPopup.style.transform = 'translate(-50%, 8px)';
            setTimeout(() => {
                if (!popupVisible) {
                    monitorPopup.style.display = 'none';
                }
            }, 180);
        };

        const bindEvents = target => {
            target?.addEventListener('click', event => {
                event.stopPropagation();
                if (clickTimer) clearTimeout(clickTimer);
                clickTimer = setTimeout(() => {
                    showPopup();
                    clickTimer = null;
                }, 220);
            });

            target?.addEventListener('dblclick', event => {
                event.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                hidePopup();
                transformControls?.attach?.(mesh);
            });
        };

        bindEvents(textDisplay);
        bindEvents(cameraMarker);

        popupClose?.addEventListener('click', event => {
            event.stopPropagation();
            hidePopup();
        });

        mesh.userData.params = params;
        syncName();

        return mesh;
    },

    getStorage: function (mesh) {
        const params = mesh.userData.params || {};
        return { ...params, text: mesh.name || params.text };
    },
};
