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
