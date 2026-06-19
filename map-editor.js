const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const coordDisplay = document.getElementById('coord-display');
const zoomDisplay = document.getElementById('zoom-display');
const btnExport = document.getElementById('btn-export');
const btnClear = document.getElementById('btn-clear');
const propFields = document.getElementById('prop-fields');
const propType = document.getElementById('prop-type');

// Editor State
let mapObjects = [];
let currentTool = 'wall';
let camera = { x: 0, y: 0, zoom: 15 }; // 15 pixels per game unit
let isDragging = false;
let isPanning = false;
let lastMouse = { x: 0, y: 0 };

// Default Properties for tools
const defaultProps = {
    wall: { width: 4, depth: 2, height: 8 },
    column: { radius: 1, height: 8 },
    chest: { width: 2.5, depth: 1.8, height: 2 },
    portal: { width: 2.5, depth: 2.5, height: 0.15, destX: 0, destZ: 0, label: "Destino" }
};

let currentProps = { ...defaultProps.wall };

// Initialize Canvas
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    // Center camera initially
    if (camera.x === 0 && camera.y === 0) {
        camera.x = canvas.width / 2;
        camera.y = canvas.height / 2;
    }
    draw();
}
window.addEventListener('resize', resizeCanvas);

// UI Event Listeners
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        
        if (currentTool !== 'erase') {
            currentProps = { ...defaultProps[currentTool] };
            renderProperties();
        } else {
            propType.innerText = "- Borrar";
            propFields.innerHTML = '<p class="hint">Haz clic en un objeto para borrarlo.</p>';
        }
    });
});

btnExport.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mapObjects, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mapa.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

btnClear.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres limpiar todo el mapa?')) {
        mapObjects = [];
        draw();
    }
});

// Render dynamic properties panel
function renderProperties() {
    propType.innerText = `- ${currentTool.charAt(0).toUpperCase() + currentTool.slice(1)}`;
    propFields.innerHTML = '';
    
    for (const key in currentProps) {
        const group = document.createElement('div');
        group.className = 'prop-group';
        
        const label = document.createElement('label');
        label.innerText = key;
        
        const input = document.createElement('input');
        input.type = typeof currentProps[key] === 'number' ? 'number' : 'text';
        input.step = '0.1';
        input.value = currentProps[key];
        
        input.addEventListener('change', (e) => {
            currentProps[key] = input.type === 'number' ? parseFloat(e.target.value) : e.target.value;
            // Update default props so next placed item has these settings
            defaultProps[currentTool][key] = currentProps[key];
        });
        
        group.appendChild(label);
        group.appendChild(input);
        propFields.appendChild(group);
    }
}

// Coordinate conversions
function screenToWorld(sx, sy) {
    return {
        x: (sx - camera.x) / camera.zoom,
        z: (sy - camera.y) / camera.zoom
    };
}

function worldToScreen(wx, wz) {
    return {
        x: wx * camera.zoom + camera.x,
        y: wz * camera.zoom + camera.y
    };
}

// Mouse Events
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.shiftKey) { // Middle click or shift+click to pan
        isPanning = true;
    } else if (e.button === 0) { // Left click
        const worldPos = screenToWorld(e.offsetX, e.offsetY);
        // Snap to grid (0.5 units)
        const snapX = Math.round(worldPos.x * 2) / 2;
        const snapZ = Math.round(worldPos.z * 2) / 2;

        if (currentTool === 'erase') {
            // Find clicked object
            for (let i = mapObjects.length - 1; i >= 0; i--) {
                const obj = mapObjects[i];
                let hit = false;
                if (obj.type === 'column' || obj.type === 'portal') {
                    const r = obj.radius || obj.width/2;
                    hit = Math.hypot(worldPos.x - obj.x, worldPos.z - obj.z) <= r;
                } else {
                    const hw = obj.width / 2;
                    const hd = obj.depth / 2;
                    hit = (worldPos.x >= obj.x - hw && worldPos.x <= obj.x + hw &&
                           worldPos.z >= obj.z - hd && worldPos.z <= obj.z + hd);
                }
                if (hit) {
                    mapObjects.splice(i, 1);
                    break; // delete one at a time
                }
            }
        } else {
            // Add object
            mapObjects.push({
                type: currentTool,
                x: snapX,
                z: snapZ,
                ...currentProps
            });
        }
        draw();
    }
    lastMouse = { x: e.offsetX, y: e.offsetY };
});

canvas.addEventListener('mousemove', (e) => {
    const worldPos = screenToWorld(e.offsetX, e.offsetY);
    coordDisplay.innerText = `X: ${worldPos.x.toFixed(1)}, Z: ${worldPos.z.toFixed(1)}`;

    if (isPanning) {
        camera.x += e.offsetX - lastMouse.x;
        camera.y += e.offsetY - lastMouse.y;
        draw();
    }
    lastMouse = { x: e.offsetX, y: e.offsetY };
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouseWorldBefore = screenToWorld(e.offsetX, e.offsetY);
    
    // Zoom
    const zoomFactor = 1.1;
    if (e.deltaY < 0) camera.zoom *= zoomFactor;
    else camera.zoom /= zoomFactor;
    
    // Clamp zoom
    camera.zoom = Math.max(2, Math.min(camera.zoom, 100));
    zoomDisplay.innerText = Math.round((camera.zoom / 15) * 100) + '%';
    
    // Adjust camera to zoom into mouse point
    const mouseWorldAfter = screenToWorld(e.offsetX, e.offsetY);
    camera.x += (mouseWorldAfter.x - mouseWorldBefore.x) * camera.zoom;
    camera.y += (mouseWorldAfter.z - mouseWorldBefore.z) * camera.zoom;
    
    draw();
});

// Drawing
function draw() {
    // Clear
    ctx.fillStyle = '#15151a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid
    ctx.strokeStyle = '#2a2a35';
    ctx.lineWidth = 1;
    
    const startWorld = screenToWorld(0, 0);
    const endWorld = screenToWorld(canvas.width, canvas.height);
    
    // Grid lines every 2 units
    const gridSize = 2;
    const startX = Math.floor(startWorld.x / gridSize) * gridSize;
    const endX = Math.ceil(endWorld.x / gridSize) * gridSize;
    const startZ = Math.floor(startWorld.z / gridSize) * gridSize;
    const endZ = Math.ceil(endWorld.z / gridSize) * gridSize;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
        const sx = worldToScreen(x, 0).x;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, canvas.height);
    }
    for (let z = startZ; z <= endZ; z += gridSize) {
        const sy = worldToScreen(0, z).y;
        ctx.moveTo(0, sy);
        ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();

    // Draw Origin axes
    ctx.strokeStyle = '#3f3f4e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const originScreen = worldToScreen(0, 0);
    ctx.moveTo(originScreen.x, 0); ctx.lineTo(originScreen.x, canvas.height);
    ctx.moveTo(0, originScreen.y); ctx.lineTo(canvas.width, originScreen.y);
    ctx.stroke();

    // Draw Objects
    mapObjects.forEach(obj => {
        const pos = worldToScreen(obj.x, obj.z);
        const w = (obj.width || obj.radius*2) * camera.zoom;
        const h = (obj.depth || obj.radius*2) * camera.zoom;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        
        if (obj.rotationY) ctx.rotate(-obj.rotationY); // ThreeJS Y rot maps to 2D rotation

        ctx.lineWidth = 2;
        if (obj.type === 'wall') {
            ctx.fillStyle = '#a29bfe';
            ctx.strokeStyle = '#6c5ce7';
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.strokeRect(-w/2, -h/2, w, h);
        } else if (obj.type === 'column') {
            ctx.fillStyle = '#74b9ff';
            ctx.strokeStyle = '#0984e3';
            ctx.beginPath();
            ctx.arc(0, 0, w/2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        } else if (obj.type === 'chest') {
            ctx.fillStyle = '#ffeaa7';
            ctx.strokeStyle = '#fdcb6e';
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.strokeRect(-w/2, -h/2, w, h);
        } else if (obj.type === 'portal') {
            ctx.fillStyle = 'rgba(85, 239, 196, 0.3)';
            ctx.strokeStyle = '#55efc4';
            ctx.beginPath();
            ctx.arc(0, 0, w/2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    });
}

// Initial setup
renderProperties();
setTimeout(resizeCanvas, 100);
