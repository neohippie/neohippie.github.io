/*
 * N E O H I P P I E
 */

if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
}

var camera, rendererGL, sceneGL;

var oceanWater;
var islandGeometry, islandVertices, islandClone;
var islandMesh;

var isDesktop = false;

var THEME_COLOR      = new THREE.Color(0xFEF10C);

var CAMERA_DIRECTION = new THREE.Vector3(0, 1, 0);
var CAMERA_POSITION  = new THREE.Vector3(777.8201414941439, 636.0861493323463, -285.5644839020942);

var ISLAND_WIDTH  = 512;
var ISLAND_HEIGHT = 512;

var WATER_LEVEL = 4000.0;
var WATER_RATE  = 0.001;

var MIN_WIDTH = 800;
var lastWidth = MIN_WIDTH;
    
var TEXTURE_ASSETS = [
    { property: 'waterNormals', file: 'assets/textures/waternormals.jpg'     },
    { property: 'heightMap'   , file: 'assets/textures/island_heightmap.png' }
];

init();
    
loadTextures(TEXTURE_ASSETS, function(textures) {
    buildScene(textures);
    animate();
});

function init() {
    var container = document.getElementById('webgl-container');
        
    rendererGL = new THREE.WebGLRenderer();
    rendererGL.setPixelRatio(window.devicePixelRatio);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 3000000);
    //camera.position.copy(CAMERA_POSITION);
    //camera.lookAt(CAMERA_DIRECTION);

    sceneGL = new THREE.Scene();

    onWindowResize();

    container.appendChild(rendererGL .domElement);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
}

function buildScene(textures) {

    // skybox
    
    var skyTexture = THREE.ImageUtils.generateDataTexture(1, 1, THEME_COLOR);
    var skyImages  = Array(6).fill(skyTexture);
    
    var cubeMap = new THREE.CubeTexture(skyImages);
    
    cubeMap.format      = THREE.RGBFormat;
    cubeMap.needsUpdate = true;
    
    var cubeShader = THREE.ShaderLib['cube'];
    cubeShader.uniforms['tCube'].value = cubeMap;

    var skyBoxMaterial = new THREE.ShaderMaterial( {
        fragmentShader: cubeShader.fragmentShader,
        vertexShader  : cubeShader.vertexShader  ,
        uniforms      : cubeShader.uniforms      ,

        depthWrite: false,
        side      : THREE.BackSide
    });

    var skyBox = new THREE.Mesh(
        new THREE.BoxGeometry(1000000, 1000000, 1000000),
        skyBoxMaterial
    );

    sceneGL.add(skyBox);
    
    // light

    var sun = new THREE.DirectionalLight(THEME_COLOR, 1);
    sun.position.set(-21500, 1000, -10000);
    
    sceneGL.add(sun);
    sceneGL.add(new THREE.AmbientLight(0x444444, 0.3));

    // ocean
    
    textures.waterNormals.wrapS = textures.waterNormals.wrapT = THREE.RepeatWrapping;
    
    oceanWater = new THREE.Water(rendererGL, camera, sceneGL, {
        textureWidth : 512,
        textureHeight: 512,

        alpha          : 1.0 ,
        distortionScale: 50.0,

        waterNormals: textures.waterNormals,        
        waterColor  : THEME_COLOR          ,

        fog: sceneGL.fog != undefined,        
    });
    
    oceanMesh = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(1000000, 1000000),
        oceanWater.material
    );

    oceanMesh.add(oceanWater);
    oceanMesh.name = 'ocean';

    oceanMesh.position.set(0, -6000, 0);
    oceanMesh.rotation.x = -Math.PI * 0.5;
    
    sceneGL.add(oceanMesh);

    // city
    
    var objLoader = new THREE.OBJLoader();
    
    objLoader.load('assets/models/la_osm.obj', function(model) {
        model.scale   .set(  10000,  10000,   10000);
        model.position.set(-300000, -12000,  400000);
        model.rotation.y = -Math.PI * 0.5;
        
        sceneGL.add(model);
    });
    
    // island

    islandGeometry = new THREE.PlaneBufferGeometry(50000, 50000, ISLAND_WIDTH-1, ISLAND_HEIGHT-1);
    islandGeometry.rotateX(-Math.PI/2);

    var islandData = generateIsland(ISLAND_WIDTH, ISLAND_HEIGHT);//loadHeight(textures.heightMap.image)
    islandVertices = islandGeometry.attributes.position.array;

    for (var i = 0, j = 0, l = islandVertices.length; i < l; i++, j += 3) {
        islandVertices[j+1] = islandData[i] * 20.0;
    }
    
    islandClone = islandVertices.slice();
    
    islandMesh = new THREE.Mesh(islandGeometry, new THREE.MeshBasicMaterial( { color: 0x000000 } ));
    islandMesh.translateY(-7000);
    //islandMesh.rotateY(Math.PI/2.2);
    
    sceneGL.add(islandMesh);
}

function onMouseDown(event) {    
    var raycaster = new THREE.Raycaster(); // create once
    var mouse     = new THREE.Vector2  ();

    mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    var point = raycaster.intersectObject(oceanMesh)[0].point;
    point.x += 50000/2;
    point.y = -7000;
    point.z += 50000/2;

    islandMesh.position.copy(point);
}

function onWindowResize() {

    rendererGL.setSize(window.innerWidth, window.innerHeight);
    
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();

    /*if (window.innerWidth < MIN_WIDTH) {

        if (isDesktop) {
            camera.position.copy(POSITION_MOBILE);
            camera.updateProjectionMatrix();
            isDesktop = false;
        }

        var direction = CAMERA_DIRECTION.applyEuler(new THREE.Euler(Math.PI/4, Math.PI/4, -Math.PI/2));
        meshGroup.translateOnAxis(direction, (window.innerWidth - lastWidth) * 12);
        console.log(meshGroup.position)

    } else {

        if (!isDesktop) {
            camera.position.copy(POSITION_DESKTOP);
            camera.updateProjectionMatrix();
            isDesktop = true;
        }

        meshGroup.position.set(0, 0, 0);
    }*/

    lastWidth = window.innerWidth;
}

function generateIsland(width, height) {
    var canvas  = document.createElement('canvas');
    var context = canvas.getContext('2d');

    canvas.width  = width;
    canvas.height = height;

    // gradient

    var gradient = context.createLinearGradient(0, -230, 0, width*2);
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(1, 'white');

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // abraham

    var rgba = context.getImageData(0, 30, 1, 1).data;

    context.fillStyle = 'rgb(' + (rgba[0]+4) + ', ' + (rgba[1]+4) + ', ' + (rgba[2]+4) + ')';
    context.font      = 'bold 40px Arial';
    context.fillText('NEOHIPPIE', 0, 30);

    // neohippie

    rgba = context.getImageData(0, 50, 1, 1).data;

    context.fillStyle = 'rgb(' + (rgba[0]-8) + ', ' + (rgba[1]-8) + ', ' + (rgba[2]-8) + ')';
    context.font      = 'bold 30px Arial';
    context.fillText('ABRAHAM', 0, 50);

    // normalize data

    var data = context.getImageData(0, 0, width, height).data;
    var normPixels = [];

    for (var i = 0, n = data.length; i < n; i += 4) {
        normPixels.push((data[i] + data[i+1] + data[i+2]) / 3);
    }

    return normPixels;
}

function loadHeight(img) {
    var canvas  = document.createElement('canvas');
    var context = canvas.getContext('2d');
    
    canvas.width  = img.width;
    canvas.height = img.height;
    
    context.drawImage(img, 0, 0, img.width, img.height);
    
    var data = context.getImageData(0, 0, img.height, img.width).data;
    var normPixels = []

    for (var i = 0, n = data.length; i < n; i += 4) {
        normPixels.push((data[i] + data[i+1] + data[i+2]) / 3);
    }

    return normPixels;
}

// simulate tide by lowering edges of island
function simulateTide() {
    for (var i = 0, j = 0; i < islandVertices.length; i++, j += 3) {

        var curLevel  = islandVertices[j+1];
        var baseLevel = islandClone   [j+1];
        
        if (baseLevel <= WATER_LEVEL && baseLevel > 0) {
            
            var theta     = WATER_RATE  * performance.now();
            var amplitude = WATER_LEVEL / baseLevel;
            
            var test = Math.sin  (theta)             * amplitude
                +  (1 - Math.abs(((theta) % 4) - 2)) * amplitude; // sawtooth
            
            if (curLevel+test < baseLevel) {
                islandVertices[j+1] += test;
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {

    simulateTide();
    
    islandGeometry.attributes.position.needsUpdate = true;
    oceanWater.material.uniforms.time.value -= 1.0 / 5.0;
    
    rendererGL.clear();
    
    oceanWater .render();
    rendererGL .render(sceneGL,  camera);
}

/*
 * three.js texture loading utility
 *
 * textureAssets is an array of objects with the following form:
 *     { property: 'textureName', file: 'path/to/texture.jpg' }
 */
function loadTextures(textureAssets, callback) {
    
    var textureLoader = new THREE.TextureLoader();
    var promises      = [];
    
    textureAssets.forEach( function(asset) {
        promises.push( new Promise( function(resolve, reject) {
        
            textureLoader.load(asset.file,
                (texture) => { resolve([asset.property, texture]);                             },
                (xhr)     => { console.log((xhr.loaded / xhr.total * 100) + '% loaded');       },
                (xhr)     => { reject( new Error('Error loading ' + asset.file + ': ' + xhr)); }
            );
        }));
    });
    
    Promise.all(promises).then( 
    
    function(assets) {
        var textures = Object.create(null);
        
        for( var [property, texture] of assets) {
            textures[property] = texture;
        }
        callback(textures);
    
    }, function(error) {
        console.error('Failed to load textures: ' + error);
    });
};
