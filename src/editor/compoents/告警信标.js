import * as THREE from 'three';

export default {
    name: '告警信标',
    label: '告警信标',

    create(storage, { scene }) {
        const params = {
            color: storage?.color || '#ff5a6f',
            radius: storage?.radius || 0.48,
            height: storage?.height || 2.2,
            speed: storage?.speed || 1
        };

        const group = new THREE.Group();
        group.name = '告警信标';

        const baseMat = new THREE.MeshStandardMaterial({ color: '#1f2531', roughness: 0.7, metalness: 0.3 });
        const ringMat = new THREE.MeshStandardMaterial({ color: '#2f3747', roughness: 0.5, metalness: 0.45 });

        const base = new THREE.Mesh(new THREE.CylinderGeometry(params.radius * 1.15, params.radius * 1.28, 0.2, 28), baseMat);
        base.position.y = 0.1;
        group.add(base);

        const ringBase = new THREE.Mesh(new THREE.TorusGeometry(params.radius * 0.95, 0.035, 14, 48), ringMat);
        ringBase.rotation.x = Math.PI * 0.5;
        ringBase.position.y = 0.205;
        group.add(ringBase);

        const glowColumn = new THREE.Mesh(
            new THREE.CylinderGeometry(params.radius * 0.3, params.radius * 0.44, params.height, 20, 1, true),
            new THREE.MeshBasicMaterial({ color: params.color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
        );
        glowColumn.position.y = params.height * 0.5 + 0.2;
        group.add(glowColumn);

        const lensMat = new THREE.MeshStandardMaterial({
            color: '#ffd2d8',
            emissive: new THREE.Color(params.color),
            emissiveIntensity: 0.65,
            roughness: 0.2,
            metalness: 0.05
        });
        const lens = new THREE.Mesh(new THREE.SphereGeometry(params.radius * 0.22, 22, 22), lensMat);
        lens.position.y = params.height + 0.34;
        group.add(lens);

        const sweep = new THREE.Mesh(
            new THREE.PlaneGeometry(params.radius * 2.2, params.height * 0.95),
            new THREE.MeshBasicMaterial({ color: params.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
        );
        sweep.position.y = params.height * 0.52 + 0.22;
        group.add(sweep);

        const pulses = [0, 1, 2].map(i => {
            const p = new THREE.Mesh(
                new THREE.RingGeometry(params.radius * 0.72, params.radius * 0.98, 48),
                new THREE.MeshBasicMaterial({ color: params.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
            );
            p.rotation.x = -Math.PI * 0.5;
            p.position.y = 0.02;
            p.userData.phase = i / 3;
            group.add(p);
            return p;
        });

        let t = 0;
        scene?.addUpdateListener?.(() => {
            t += 0.012 * params.speed;

            pulses.forEach(r => {
                const p = (t + r.userData.phase) % 1;
                const s = 1 + p * 2.6;
                r.scale.set(s, s, 1);
                r.material.opacity = 0.5 * (1 - p);
            });

            sweep.rotation.y += 0.025 * params.speed;
            const breath = 0.55 + Math.sin(t * 8.2) * 0.2;
            lens.material.emissiveIntensity = breath;
            glowColumn.material.opacity = 0.16 + Math.sin(t * 7.2) * 0.05;
            lens.position.y = params.height + 0.34 + Math.sin(t * 10.5) * 0.045;
        });

        group.userData.params = params;
        group.REMOVECALL = () => {
            group.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
        };

        return group;
    },

    getStorage(mesh) {
        const p = mesh?.userData?.params || {};
        const radius = Number(p.radius);
        const height = Number(p.height);
        const speed = Number(p.speed);
        return {
            color: p.color || '#ff5a6f',
            radius: Number.isFinite(radius) ? radius : 0.48,
            height: Number.isFinite(height) ? height : 2.2,
            speed: Number.isFinite(speed) ? speed : 1
        };
    }
};
