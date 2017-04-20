/*
 * N E O H I P P I E
 */

if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
}

var camera;

var sceneGL, rendererGL;
var oceanWater;
var islandGeometry, islandVertices, islandClone;

var sceneCSS, rendererCSS;
var soundElement;

var worldWidth = 512, worldDepth = 512,
    worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2;
    
var themeColor = new THREE.Color(0xFEF10C);

var mouseY = 0;
var CAMERA_RATE = 0.05;
    
var textureAssets = [
    { property: 'waterNormals', file: 'assets/textures/waternormals.jpg'     },
    { property: 'heightMap'   , file: 'assets/textures/island_heightmap.png' },
    { property: 'sand'        , file: 'assets/textures/sand.jpg'             }
];
    
loadTextures(textureAssets, function(textures) {
    init(textures);

    window.addEventListener('resize'   , onWindowResize);
    window.addEventListener('mousemove', onMouseMove   );

    animate();
});

function init(textures) {

    var container = document.createElement('div');
    container.id  = "container";
    
    document.body.appendChild(container);
    
    rendererGL = new THREE.WebGLRenderer();
    rendererGL.setPixelRatio(window.devicePixelRatio);
    rendererGL.setSize(window.innerWidth, window.innerHeight);
    
    container.appendChild(rendererGL.domElement);
    
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 3000000);
    camera.position.set(999.7691121715444, 16.707317311820717, 14.662964590995808);
    
    controls = new THREE.OrbitControls(camera, rendererGL.domElement);
    controls.enablePan = false;
    controls.minDistance = 1000.0;
    controls.maxDistance = 5000.0;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 1, 0);
    
    sceneGL = new THREE.Scene();
    
    // light

    var sun = new THREE.DirectionalLight(themeColor, 1);
    sun.position.set(-21500, 1000, -10000);
    
    sceneGL.add(sun);
    sceneGL.add(new THREE.AmbientLight(0x444444, 0.3));
    
    // island

    islandGeometry = new THREE.PlaneBufferGeometry(50000, 50000, worldWidth-1, worldDepth-1);
    islandGeometry.rotateX(-Math.PI/2);

    var islandData = loadHeight(textures.heightMap.image)
    islandVertices = islandGeometry.attributes.position.array;

    for (var i = 0, j = 0, l = islandVertices.length; i < l; i++, j += 3) {
        islandVertices[j+1] = islandData[i] * 20.0;
    }
    
    islandClone = islandVertices.slice();

    textures.sand.wrapS    = textures.sand.wrapT    = THREE.RepeatWrapping;
    textures.sand.repeat.x = textures.sand.repeat.y = 3;
    
    var islandMaterial = new THREE.MeshLambertMaterial( { 
        map: textures.sand, 
        polygonOffset: true,
        polygonOffsetFactor: 1.0
    });

    var islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
    
    islandMesh.position.set(-10000, -7000, 7000);
    islandMesh.rotateY(Math.PI/2.2);
    
    sceneGL.add(islandMesh);
    
    // ocean
    
    textures.waterNormals.wrapS = textures.waterNormals.wrapT = THREE.RepeatWrapping;
    
    oceanWater = new THREE.Water(rendererGL, camera, sceneGL, {
        textureWidth:  512,
        textureHeight: 512,
        waterNormals: textures.waterNormals,
        alpha: 	0.95,
        
        waterColor: themeColor, //0x001e0f,
        distortionScale: 50.0,
        fog: sceneGL.fog != undefined
    });
    
    oceanMesh = new THREE.Mesh(
        new THREE.PlaneBufferGeometry(1000000, 1000000),
        oceanWater.material
    );

    oceanMesh.add(oceanWater);
    oceanMesh.position.set(0, -6000, 0);
    oceanMesh.rotation.x = -Math.PI * 0.5;
    
    sceneGL.add(oceanMesh);
    
    // skybox
    
    var skyTexture = THREE.ImageUtils.generateDataTexture(1, 1, themeColor);
    var skyImages = Array(6).fill(skyTexture);
    
    var cubeMap = new THREE.CubeTexture(skyImages);
    
    cubeMap.format      = THREE.RGBFormat;
    cubeMap.needsUpdate = true;
    
    var cubeShader = THREE.ShaderLib['cube'];
    cubeShader.uniforms['tCube'].value = cubeMap;

    var skyBoxMaterial = new THREE.ShaderMaterial( {
        fragmentShader: cubeShader.fragmentShader,
        vertexShader: cubeShader.vertexShader,
        uniforms: cubeShader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    });

    var skyBox = new THREE.Mesh(
        new THREE.BoxGeometry(1000000, 1000000, 1000000),
        skyBoxMaterial
    );

    sceneGL.add(skyBox);
    
    // city
    
    var objLoader = new THREE.OBJLoader();
    
    objLoader.load('assets/models/la_osm_min_blocks_variable_land.obj', function (model) {
        model.scale   .set(  10000,  10000,   10000);
        model.position.set(-300000, -12000, 400000);
        model.rotation.y = -Math.PI * 0.5;
        
        sceneGL.add(model);
    });

    // soundcloud player

    var soundWidth  = window.innerHeight / 1.3;
    var soundHeight = soundWidth;

    rendererCSS	= new THREE.CSS3DRenderer();

    rendererCSS.setSize(soundWidth, soundHeight);
    rendererCSS.domElement.style.position = 'absolute';
    rendererCSS.domElement.style.top      = '0px';
    rendererCSS.domElement.style.right    = '0px';

    container.appendChild(rendererCSS.domElement);

    sceneCSS = new THREE.Scene();
    
    var iframe = document.createElement('iframe');
    iframe.style.width  = soundWidth  + 'px';
    iframe.style.height = soundHeight + 'px';
    iframe.style.border = '0px';
    iframe.src = 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/269982914&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true';
    
    soundElement = new THREE.CSS3DObject(iframe);
    soundElement.position.set(380, 0, 0);
    soundElement.rotation.y = Math.PI * 0.45;

    sceneCSS.add(soundElement);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    rendererGL .setSize(window.innerWidth,   window.innerHeight);
    rendererCSS.setSize(window.innerWidth/3, window.innerHeight/2);
}

function onMouseMove(e) {
    camera.position.y += (mouseY - e.clientY) * CAMERA_RATE;
    mouseY = e.clientY;
}

function loadHeight(img) {
    var canvas = document.createElement('canvas');
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

function animate() {
    requestAnimationFrame(animate);
    render();
}

var WATER_LEVEL = 4000.0;
var WATER_RATE  = 0.001;

function render() {
    
    // simulate tide by lowering edges of island
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
    
    islandGeometry.attributes.position.needsUpdate = true;
    oceanWater.material.uniforms.time.value -= 1.0 / 5.0;
    
    controls.update();
    rendererGL.clear();
    
    //console.log(camera.position);

    oceanWater .render();
    rendererGL .render(sceneGL,  camera);
    rendererCSS.render(sceneCSS, camera);
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
