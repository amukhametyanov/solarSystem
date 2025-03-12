// Solar system data
const solarSystemData = {
    sun: { radius: 5, color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 1 },
    planets: [
        { name: "Mercury", radius: 0.5, color: 0xa9a9a9, distance: 10, orbitSpeed: 0.04, rotationSpeed: 0.04 },
        { name: "Venus", radius: 0.9, color: 0xe39e1c, distance: 15, orbitSpeed: 0.015, rotationSpeed: 0.02 },
        { name: "Earth", radius: 1, color: 0x3498db, distance: 20, orbitSpeed: 0.01, rotationSpeed: 0.02 },
        { name: "Mars", radius: 0.7, color: 0xe74c3c, distance: 25, orbitSpeed: 0.008, rotationSpeed: 0.018 },
        { name: "Jupiter", radius: 2.5, color: 0xf39c12, distance: 35, orbitSpeed: 0.002, rotationSpeed: 0.04 },
        { name: "Saturn", radius: 2.2, color: 0xf5cba7, distance: 45, orbitSpeed: 0.0009, rotationSpeed: 0.038,
            ring: { innerRadius: 2.5, outerRadius: 4, color: 0xc9c098 } },
        { name: "Uranus", radius: 1.8, color: 0xaed6f1, distance: 60, orbitSpeed: 0.0004, rotationSpeed: 0.03 },
        { name: "Neptune", radius: 1.7, color: 0x2980b9, distance: 75, orbitSpeed: 0.0001, rotationSpeed: 0.032 }
    ]
};

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Raycaster for planet selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPlanet = null;
let originalPosition = new THREE.Vector3();
let dragging = false;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();

// Camera initial position
camera.position.z = 50;
camera.position.y = 20;
camera.lookAt(0, 0, 0);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

// Add point light at the sun position
const sunLight = new THREE.PointLight(0xffffff, 2, 300);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// Add sun
const sunGeometry = new THREE.SphereGeometry(solarSystemData.sun.radius, 32, 32);
const sunMaterial = new THREE.MeshStandardMaterial({
    color: solarSystemData.sun.color,
    emissive: solarSystemData.sun.emissive,
    emissiveIntensity: solarSystemData.sun.emissiveIntensity
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Create starfield as a skybox
function createStars() {
    // Create a large sphere for the stars
    const starsSphereRadius = 450; // Much larger than the farthest planet
    const starsGeometry = new THREE.SphereGeometry(starsSphereRadius, 64, 64);
    
    // Create star texture
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add stars to the texture
    for (let i = 0; i < 10000; i++) {
        const size = Math.random() * 2;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        
        const brightness = Math.random();
        context.fillStyle = `rgba(255, 255, 255, ${brightness})`;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
    }
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create material with the stars on the inside of the sphere
    const starsMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide, // Render inside of the sphere
    });
    
    // Create mesh
    const stars = new THREE.Mesh(starsGeometry, starsMaterial);
    scene.add(stars);
}
createStars();

// Create orbit lines
function createOrbitLine(radius) {
    const orbitGeometry = new THREE.BufferGeometry();
    const points = [];
    
    for (let i = 0; i <= 360; i++) {
        const angle = (i * Math.PI) / 180;
        points.push(new THREE.Vector3(
            radius * Math.sin(angle),
            0,
            radius * Math.cos(angle)
        ));
    }
    
    orbitGeometry.setFromPoints(points);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 });
    const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
    return orbit;
}

// Add planets
const planets = [];
solarSystemData.planets.forEach(planetData => {
    // Create planet
    const planetGeometry = new THREE.SphereGeometry(planetData.radius, 32, 16);
    const planetMaterial = new THREE.MeshStandardMaterial({ color: planetData.color });
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    
    // Create planet object
    const planetObj = new THREE.Object3D();
    scene.add(planetObj);
    
    // Add orbit line
    const orbitLine = createOrbitLine(planetData.distance);
    scene.add(orbitLine);
    
    // Position planet
    planetObj.add(planet);
    planet.position.x = planetData.distance;
    
    // Add rings if the planet has them (Saturn)
    if (planetData.ring) {
        const ringGeometry = new THREE.RingGeometry(
            planetData.ring.innerRadius, 
            planetData.ring.outerRadius, 
            64
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: planetData.ring.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        planet.add(ring);
    }
    
    // Store original orbit data for restore function
    planet.userData = {
        orbitObj: planetObj,
        originalDistance: planetData.distance,
        originalOrbitPosition: planetObj.rotation.y,
        returningToOrbit: false,
        returnSpeed: 0.05
    };
    
    // Store planet data for animation
    planets.push({
        mesh: planetObj,
        body: planet,
        data: planetData
    });
});

// Controls
const moveSpeed = 0.5;
const turnSpeed = 0.01;
const keys = {
    w: false, a: false, s: false, d: false,
    up: false, left: false, down: false, right: false,
    q: false, e: false
};

let mouseDown = false;
let rightMouseDown = false;
let mouseX = 0;
let mouseY = 0;

// Event listeners for keyboard
window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case 'arrowup': keys.up = true; break;
        case 'arrowleft': keys.left = true; break;
        case 'arrowdown': keys.down = true; break;
        case 'arrowright': keys.right = true; break;
        case 'q': keys.q = true; break;
        case 'e': keys.e = true; break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case 'arrowup': keys.up = false; break;
        case 'arrowleft': keys.left = false; break;
        case 'arrowdown': keys.down = false; break;
        case 'arrowright': keys.right = false; break;
        case 'q': keys.q = false; break;
        case 'e': keys.e = false; break;
    }
});

// Planet selection and drag functions
function findIntersectedPlanet(event) {
    // Convert mouse position to normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Find intersected objects
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Find the first intersected planet
    for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        
        // Check if this is a planet
        const planetIndex = planets.findIndex(p => p.body === object);
        if (planetIndex !== -1) {
            return {
                object: object,
                point: intersects[i].point,
                distance: intersects[i].distance
            };
        }
    }
    
    return null;
}

// Animation parameters for returning planets
const RETURN_DURATION = 1.5; // seconds for animation
let returningPlanets = [];

// Function to return a planet to its orbit
function createReturnAnimation(planetBody, planetData) {
    // Get current world position of the planet
    const worldPosition = new THREE.Vector3();
    planetBody.getWorldPosition(worldPosition);
    
    // Create animation data
    return {
        planet: planetBody,
        planetData: planetData,
        startPosition: worldPosition.clone(),
        endPosition: new THREE.Vector3(planetData.data.distance, 0, 0), // Local position in orbit
        startTime: Date.now() / 1000, // Current time in seconds
        endTime: Date.now() / 1000 + RETURN_DURATION
    };
}

// Mouse event listeners
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left mouse button
        const intersection = findIntersectedPlanet(e);
        if (intersection) {
            selectedPlanet = intersection.object;
            originalPosition.copy(selectedPlanet.position);
            
            // Remove planet from its orbit during drag
            if (selectedPlanet.parent) {
                const worldPosition = new THREE.Vector3();
                selectedPlanet.getWorldPosition(worldPosition);
                scene.attach(selectedPlanet);
                selectedPlanet.position.copy(worldPosition);
            }
            
            // Store initial interaction data
            dragOffset = new THREE.Vector3();
            dragOffset.copy(selectedPlanet.position);
            dragOffset.project(camera);
            
            // Store the initial z-depth for depth movement
            selectedPlanet.userData.initialZ = selectedPlanet.position.distanceTo(camera.position);
            selectedPlanet.userData.initialMouseY = e.clientY;
            
            dragging = true;
        }
    } else if (e.button === 2) { // Right mouse button
        rightMouseDown = true;
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { // Left mouse button
        if (dragging && selectedPlanet) {
            // Find the planet data
            const planetIndex = planets.findIndex(p => p.body === selectedPlanet);
            if (planetIndex !== -1) {
                const planetData = planets[planetIndex];
                
                // Create return animation
                const returnAnimation = createReturnAnimation(selectedPlanet, planetData);
                returningPlanets.push(returnAnimation);
            }
        }
        dragging = false;
        selectedPlanet = null;
    } else if (e.button === 2) { // Right mouse button
        rightMouseDown = false;
    }
});

window.addEventListener('mousemove', (e) => {
    if (dragging && selectedPlanet) {
        // Update mouse position
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // Create vector for new position
        const vector = new THREE.Vector3(mouse.x, mouse.y, dragOffset.z);
        vector.unproject(camera);
        
        // Calculate direction from camera to this position
        const dir = vector.sub(camera.position).normalize();
        
        // Calculate distance from camera based on mouse Y movement
        const mouseYDelta = e.clientY - selectedPlanet.userData.initialMouseY;
        const zoomFactor = mouseYDelta * 0.05; // Adjust this value to control zoom sensitivity
        const newDistance = selectedPlanet.userData.initialZ - zoomFactor;
        
        // Set new position along the ray
        const newPos = camera.position.clone().add(dir.multiplyScalar(newDistance));
        selectedPlanet.position.copy(newPos);
    } else if (rightMouseDown) {
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        
        mouseX += movementX;
        mouseY += movementY;
        
        // Rotate camera based on mouse movement
        camera.rotation.y -= movementX * turnSpeed * 0.1;
        camera.rotation.x -= movementY * turnSpeed * 0.1;
        
        // Limit vertical rotation to prevent flipping
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
});

// Prevent context menu on right-click
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update planets
    planets.forEach(planet => {
        // Check if this planet is being dragged
        const isBeingDragged = selectedPlanet === planet.body;
        
        // Only rotate planets that aren't being dragged
        if (!isBeingDragged) {
            // Rotate planet around its axis
            planet.body.rotation.y += planet.data.rotationSpeed;
            
            // Rotate planet around the sun
            planet.mesh.rotation.y += planet.data.orbitSpeed;
            
    // Handle returning planets
    const currentTime = Date.now() / 1000;
    for (let i = returningPlanets.length - 1; i >= 0; i--) {
        const returnData = returningPlanets[i];
        const { planet, planetData, startPosition, endPosition, startTime, endTime } = returnData;
        
        // Calculate progress (0 to 1)
        const progress = Math.min(1, (currentTime - startTime) / (endTime - startTime));
        
        if (progress < 1) {
            // Easing function for smoother animation (ease-out)
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            // Get current world position of orbit point
            const orbitPoint = new THREE.Vector3(planetData.data.distance, 0, 0);
            const worldOrbitPoint = new THREE.Vector3();
            planetData.mesh.localToWorld(worldOrbitPoint.copy(orbitPoint));
            
            // Interpolate between start position and orbit point
            const currentPosition = new THREE.Vector3();
            currentPosition.lerpVectors(startPosition, worldOrbitPoint, easedProgress);
            
            // Update planet position in world space
            planet.position.copy(currentPosition);
        } else {
            // Animation finished, attach planet back to its orbit
            scene.remove(planet);
            planetData.mesh.add(planet);
            planet.position.copy(endPosition);
            
            // Remove from the animation list
            returningPlanets.splice(i, 1);
        }
    }
        }
    });
    
    // Rotate sun
    sun.rotation.y += 0.001;
    
    // Handle camera movement
    const moveForward = keys.w || keys.up;
    const moveBackward = keys.s || keys.down;
    const moveLeft = keys.a || keys.left;
    const moveRight = keys.d || keys.right;
    const moveUp = keys.e;
    const moveDown = keys.q;
    
    // Get camera direction vector
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Move forward/backward
    if (moveForward) {
        camera.position.addScaledVector(cameraDirection, moveSpeed);
    }
    if (moveBackward) {
        camera.position.addScaledVector(cameraDirection, -moveSpeed);
    }
    
    // Move left/right (perpendicular to forward direction)
    if (moveLeft || moveRight) {
        const rightVector = new THREE.Vector3()
            .crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
            .normalize();
        
        if (moveRight) {
            camera.position.addScaledVector(rightVector, moveSpeed);
        }
        if (moveLeft) {
            camera.position.addScaledVector(rightVector, -moveSpeed);
        }
    }
    
    // Move up/down (absolute y-axis)
    if (moveUp) {
        camera.position.y += moveSpeed;
    }
    if (moveDown) {
        camera.position.y -= moveSpeed;
    }
    
    renderer.render(scene, camera);
}

animate();