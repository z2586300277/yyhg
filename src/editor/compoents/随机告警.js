import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const STYLE_ID = 'random-alert-label-style';

const LEVELS = [
    {
        label: '提示',
        color: '#78d7ff',
        messages: ['温度存在轻微波动', '网络延迟略高于基线', '设备负载进入观察区间']
    },
    {
        label: '注意',
        color: '#ffd166',
        messages: ['电流短时突增，请检查供电', '风扇转速异常波动', '磁盘读写接近阈值']
    },
    {
        label: '严重',
        color: '#ff9b54',
        messages: ['设备温度持续偏高', '核心服务出现反复重试', '关键链路丢包率上升']
    },
    {
        label: '紧急',
        color: '#ff4d6d',
        messages: ['设备离线，建议立即排查', '检测到烟感异常触发', '主电源告警，请快速处理']
    }
];

const SOURCES = ['温度传感器', '门禁系统', '电力监测', '烟感系统'];

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatNow() {
    const d = new Date();
    const pad = v => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function makeRandomAlarm() {
    const level = pickRandom(LEVELS);
    return {
        alertLevel: level.label,
        alertColor: level.color,
        alertMessage: pickRandom(level.messages),
        alertCode: 'ALM-' + Math.floor(Math.random() * 90000 + 10000),
        lastTime: formatNow(),
        source: pickRandom(SOURCES)
    };
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes randomAlertPulse {
            0% { transform: scale(0.82); opacity: 0.9; }
            70% { transform: scale(1.18); opacity: 0; }
            100% { transform: scale(1.18); opacity: 0; }
        }
    `;

    document.head.appendChild(style);
}

export default {
    name: '随机告警',
    label: '随机告警',

    create: function (storage, { transformControls }) {
        ensureStyle();

        const initialAlarm = storage?.alertLevel ? {
            alertLevel: storage.alertLevel,
            alertColor: storage.alertColor || '#ff9b54',
            alertMessage: storage.alertMessage || '告警详情缺失',
            alertCode: storage.alertCode || 'ALM-00000',
            lastTime: storage.lastTime || formatNow(),
            source: storage.source || '监测系统'
        } : makeRandomAlarm();

        const params = {
            text: storage?.text || '设备' + Math.floor(Math.random() * 1000),
            fontSize: storage?.fontSize || '16px',
            color: storage?.color || '#ffd3dc',
            bold: storage?.bold || 'normal',
            ...initialAlarm
        };

        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.textAlign = 'center';
        container.style.gap = '6px';
        container.style.setProperty('--alarm-color', params.alertColor);

        container.innerHTML = `
            <div id="textDisplay" style="text-align:center; pointer-events:auto; cursor:pointer; user-select:none;">
                <span id="textSpan" style="font-size:${params.fontSize}; color:${params.color}; font-weight:${params.bold}; text-shadow:0 0 10px rgba(255, 83, 112, 0.35);"></span>
            </div>

            <div id="alertMarker" style="position:relative; pointer-events:auto; width:42px; height:42px; cursor:pointer; display:flex; justify-content:center; align-items:center; margin:0 auto;">
                <div id="markerPulse" style="position:absolute; inset:-4px; border-radius:50%; border:1px solid var(--alarm-color); animation:randomAlertPulse 1.4s ease-out infinite;"></div>
                <div id="markerCore" style="position:relative; z-index:1; width:34px; height:34px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #fff, var(--alarm-color)); display:flex; justify-content:center; align-items:center; color:#111; font-weight:700; box-shadow:0 0 16px color-mix(in srgb, var(--alarm-color) 55%, transparent);">!</div>
            </div>

            <div id="alarmPopup" style="position:absolute; left:50%; bottom:56px; transform:translate(-50%, 0px); width:236px; padding:10px 12px; border-radius:12px; background:linear-gradient(145deg, rgba(42, 15, 22, 0.96), rgba(18, 9, 12, 0.95)); border:1px solid rgba(255, 138, 162, 0.45); box-shadow:0 12px 28px rgba(0, 0, 0, 0.4), inset 0 0 18px rgba(255, 101, 142, 0.16); backdrop-filter:blur(6px); text-align:left; color:#ffe7ee; pointer-events:auto; z-index:10; display:none; opacity:0; transition:opacity .18s ease, transform .18s ease;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-size:13px; font-weight:700; color:#ffc0d1;">随机告警</span>
                    <button id="popupClose" style="pointer-events:auto; border:none; background:transparent; color:#ffd5e2; font-size:14px; cursor:pointer; padding:0 2px;">✕</button>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                    <span id="popupLevel" style="font-size:11px; padding:2px 8px; border-radius:999px;"></span>
                    <span id="popupCode" style="font-size:11px; color:#ffd9e3;"></span>
                </div>

                <div style="display:grid; grid-template-columns:56px 1fr; row-gap:4px; column-gap:6px; font-size:12px; line-height:1.35;">
                    <span style="color:#d8a8b8;">设备</span><span id="popupDevice" style="color:#fff2f6;"></span>
                    <span style="color:#d8a8b8;">来源</span><span id="popupSource" style="color:#ffe6ee;"></span>
                    <span style="color:#d8a8b8;">详情</span><span id="popupMsg" style="color:#fff2f6;"></span>
                    <span style="color:#d8a8b8;">时间</span><span id="popupTime" style="color:#ffe6ee;"></span>
                </div>

                <button id="refreshBtn" style="pointer-events:auto; width:100%; margin-top:10px; border:none; border-radius:8px; padding:6px 8px; cursor:pointer; font-size:12px; background:linear-gradient(90deg, rgba(255, 82, 126, 0.95), rgba(255, 124, 94, 0.95)); color:#fff;">刷新告警</button>

                <div style="position:absolute; left:50%; bottom:-6px; width:12px; height:12px; transform:translateX(-50%) rotate(45deg); background:rgba(18, 9, 12, 0.95); border-right:1px solid rgba(255, 138, 162, 0.45); border-bottom:1px solid rgba(255, 138, 162, 0.45);"></div>
            </div>
        `;

        const textDisplay = container.querySelector('#textDisplay');
        const textSpan = container.querySelector('#textSpan');
        const alertMarker = container.querySelector('#alertMarker');
        const markerCore = container.querySelector('#markerCore');
        const alarmPopup = container.querySelector('#alarmPopup');
        const popupClose = container.querySelector('#popupClose');
        const refreshBtn = container.querySelector('#refreshBtn');

        const popupLevel = container.querySelector('#popupLevel');
        const popupCode = container.querySelector('#popupCode');
        const popupDevice = container.querySelector('#popupDevice');
        const popupSource = container.querySelector('#popupSource');
        const popupMsg = container.querySelector('#popupMsg');
        const popupTime = container.querySelector('#popupTime');

        const mesh = new CSS2DObject(container);

        mesh.name = String(storage?.name || params.text);
        params.text = mesh.name;

        const syncName = () => {
            const name = String(mesh.name || params.text);
            params.text = name;
            textSpan.textContent = name;
            popupDevice.textContent = name;
        };

        const renderAlarm = () => {
            container.style.setProperty('--alarm-color', params.alertColor);
            markerCore.textContent = params.alertLevel === '紧急' ? '!!' : '!';

            popupLevel.textContent = params.alertLevel;
            popupLevel.style.color = params.alertColor;
            popupLevel.style.background = `${params.alertColor}22`;
            popupCode.textContent = params.alertCode;
            popupSource.textContent = params.source;
            popupMsg.textContent = params.alertMessage;
            popupTime.textContent = params.lastTime;
        };

        const randomizeAlarm = () => {
            const next = makeRandomAlarm();
            params.alertLevel = next.alertLevel;
            params.alertColor = next.alertColor;
            params.alertMessage = next.alertMessage;
            params.alertCode = next.alertCode;
            params.lastTime = next.lastTime;
            params.source = next.source;
            renderAlarm();
        };

        let popupVisible = false;
        let clickTimer = null;

        const showPopup = () => {
            syncName();
            renderAlarm();
            popupVisible = true;
            alarmPopup.style.display = 'block';
            requestAnimationFrame(() => {
                alarmPopup.style.opacity = '1';
                alarmPopup.style.transform = 'translate(-50%, -8px)';
            });
        };

        const hidePopup = () => {
            popupVisible = false;
            alarmPopup.style.opacity = '0';
            alarmPopup.style.transform = 'translate(-50%, 0px)';
            setTimeout(() => {
                if (!popupVisible) {
                    alarmPopup.style.display = 'none';
                }
            }, 180);
        };

        const bindMarkerEvents = target => {
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

        bindMarkerEvents(textDisplay);
        bindMarkerEvents(alertMarker);

        popupClose?.addEventListener('click', event => {
            event.stopPropagation();
            hidePopup();
        });

        refreshBtn?.addEventListener('click', event => {
            event.stopPropagation();
            randomizeAlarm();
        });

        mesh.userData.params = params;
        syncName();
        renderAlarm();

        return mesh;
    },

    getStorage: function (mesh) {
        const params = mesh.userData.params || {};
        return { ...params, text: mesh.name || params.text };
    },
};
