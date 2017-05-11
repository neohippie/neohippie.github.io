/*
 * N E O H I P P I E
 */

if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
}

var rendererGL, camera;
var sceneGL, raycaster;

var lookAtMatrix, lookAtInverse;

var controlsFps;
var controlsOrbit;

var oceanWater;

var islandHeightmap;
var islandGeometry, islandVertices, islandClone;
var islandMesh;

var THEME_COLOR      = new THREE.Color(0xFEF10C);
var CAMERA_DIRECTION = new THREE.Vector3(-778, -636, 286);

var HEIGHTMAP_WIDTH  = 256;
var HEIGHTMAP_HEIGHT = 256;

var WATER_LEVEL = 4000.0;
var WATER_RATE  = 0.001;
    
var TEXTURE_ASSETS = [
    { property: 'waterNormals', file: 'assets/textures/waternormals.jpg' }
];

init();
    
loadTextures(TEXTURE_ASSETS, function(textures) {
    buildScene(textures);
    animate();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
});

function init() {
    var container = document.getElementById('webgl-container');
        
    rendererGL = new THREE.WebGLRenderer();
    rendererGL.setPixelRatio(window.devicePixelRatio);
    rendererGL.setSize(window.innerWidth, window.innerHeight);

    container.appendChild(rendererGL.domElement);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.5, 3000000);

    lookAtMatrix  = new THREE.Matrix4();
    lookAtInverse = new THREE.Matrix4();

    lookAtMatrix .lookAt(camera.position, CAMERA_DIRECTION, camera.up);
    lookAtInverse.getInverse(lookAtMatrix);
    
    /*controlsFps = new THREE.FirstPersonControls(camera, rendererGL.domElement);
    controlsFps.activeLook = false;
    controlsFps.movementSpeed = 10000;*/

    /*controlsOrbit = new THREE.OrbitControls(camera, rendererGL.domElement);
    controlsOrbit.minDistance = 1000.0;
    controlsOrbit.maxDistance = 5000.0;
    controlsOrbit.maxPolarAngle = Math.PI * 0.495;
    controlsOrbit.target.set(0, 1, 0);*/

    sceneGL   = new THREE.Scene();
    raycaster = new THREE.Raycaster();
}

function onWindowResize() {
    rendererGL.setSize(window.innerWidth, window.innerHeight);
    
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();

    rendererGL.render(sceneGL, camera);
    transformIsland();
}

function onMouseDown(event) {
    var mouse = new THREE.Vector2((event.clientX/window.innerWidth)  * 2 - 1,
                                 -(event.clientY/window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(mouse, camera);

    var islandLeft = raycaster.intersectObject(oceanMesh)[0].point;
    islandLeft.applyMatrix4(lookAtMatrix);

    islandMesh.position.x = islandLeft.x + islandMesh.scale.x/2;
    islandMesh.position.z = islandLeft.z - islandMesh.scale.z/2;
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

    oceanMesh.position.set(0, -5200, 0);
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

    islandGeometry = new THREE.PlaneBufferGeometry(1, 1, HEIGHTMAP_WIDTH-1, HEIGHTMAP_HEIGHT-1);
    islandGeometry.rotateX(-Math.PI/2);
    
    islandVertices  = islandGeometry.attributes.position.array;
    islandHeightmap = generateHeightmap(HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT);

    for (var i = 0, j = 0, l = islandVertices.length; i < l; i++, j += 3) {
        islandVertices[j+1] = islandHeightmap[i] * 20.0;
    }

    islandClone = islandVertices.slice();

    islandMesh = new THREE.Mesh(islandGeometry, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    islandMesh.rotateY(Math.PI/2);
    islandMesh.translateY(-7000);

    sceneGL.applyMatrix(lookAtInverse);
    rendererGL.render(sceneGL, camera);

    transformIsland();
    sceneGL.add(islandMesh);
}

function transformIsland() {
    var screenLeftPx  = new THREE.Vector2(window.innerWidth/6, window.innerHeight / (0.004*window.innerWidth));
    var screenRightPx = new THREE.Vector2(window.innerWidth  , window.innerHeight /  2                       );

    var screenLeft  = new THREE.Vector2((screenLeftPx .x/window.innerWidth ) * 2 - 1, 
                                       -(screenLeftPx .y/window.innerHeight) * 2 + 1);

    var screenRight = new THREE.Vector2((screenRightPx.x/window.innerWidth ) * 2 - 1, 
                                       -(screenRightPx.y/window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(screenLeft , camera);
    var islandLeft  = raycaster.intersectObject(oceanMesh)[0].point;

    raycaster.setFromCamera(screenRight, camera);
    var islandRight = raycaster.intersectObject(oceanMesh)[0].point;

    islandLeft .applyMatrix4(lookAtMatrix);
    islandRight.applyMatrix4(lookAtMatrix);

    var islandSize = islandLeft.distanceTo(islandRight);

    islandMesh.scale.x = islandSize;
    islandMesh.scale.z = islandSize;

    islandMesh.position.x = islandLeft.x + islandSize/2;
    islandMesh.position.z = islandLeft.z - islandSize/2;
}

function generateHeightmap(width, height) {
    var canvas  = document.createElement('canvas');
    var context = canvas.getContext('2d');

    canvas.width  = width;
    canvas.height = height;

    // gradient

    var gradient = context.createLinearGradient(0, -170, 0, width*2);
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(1, 'white');

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // neohippie

    var rgba = context.getImageData(0, 70, 1, 1).data;
    var text = 'NEOHIPPIE';

    context.fillStyle = 'rgb(' + (rgba[0]+8) + ', ' + (rgba[1]+8) + ', ' + (rgba[2]+8) + ')';
    context.font      = 'bold 48px Arial';

    var neohippieWidth = context.measureText(text).width;
    context.fillText(text, width-neohippieWidth, 70);

    // abraham

    rgba = context.getImageData(0, 100, 1, 1).data;
    text = 'ABRAHAM';

    context.fillStyle = 'rgb(' + (rgba[0]-16) + ', ' + (rgba[1]-16) + ', ' + (rgba[2]-16) + ')';
    context.font      = 'bold 36px Arial';
    context.fillText(text, (width-neohippieWidth) + (neohippieWidth-context.measureText(text).width)/1.5, 100);

    // normalize data

    var data = context.getImageData(0, 0, width, height).data;
    var normPixels = [];

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

    //controlsFps.update(1);
    //controlsOrbit.update();
    //console.log(camera);
    
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
