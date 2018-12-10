/**
* Richard Kogut
* Wed Dec 3, 2018
*
* Sources:
* https://github.com/mrdoob/three.js/blob/master/examples/webgl_postprocessing_unreal_bloom.html
* https://github.com/mrdoob/three.js/blob/master/examples/webgl_refraction.html
* https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_bumpmap_skin.html
**/



var container, stats, loader;
var camera, scene, renderer, controls, controlsParticles;
var mesh;
var directionalLight;
var targetX = 0, targetY = 0;
var composerBeckmann;
var bloomPass;
var params;
var particleSystem, spawnerOptions, options;
var tick = 0;
var clock = new THREE.Clock();
var gui;
var windowPane;
var numParticleSystems =0;

init();
animate();

function init() {
  container = document.createElement( 'div' );
  document.body.appendChild( container );
  //
  camera = new THREE.PerspectiveCamera( 27, window.innerWidth / window.innerHeight, 1, 10000 );
  camera.position.z = 2500;
  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0x242a34 );


  params = {exposure: 1,bloomStrength: 0,bloomThreshold: .75,bloomRadius: 0};
  bloomPass = new THREE.UnrealBloomPass( (window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.15 );
  bloomPass.renderToScreen = true;
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  gui = new dat.GUI();
  //further bloom controls if needed
  // gui.add( params, 'exposure', 0.1, 2 ).onChange( function ( value ) {renderer.toneMappingExposure = Math.pow( value, 4.0 );} );
  // gui.add( params, 'bloomThreshold', 0.0, 1.0 ).onChange( function ( value ) {bloomPass.threshold = Number( value );} );
  gui.add( params, 'bloomStrength', 0.0, 3.0 ).onChange( function ( value ) {bloomPass.strength = Number( value );} );
  gui.add( params, 'bloomRadius', 0.0, 1.0 ).step( 0.01 ).onChange( function ( value ) {bloomPass.radius = Number( value );} );

  // LIGHTS
  scene.add( new THREE.AmbientLight( 0x333344 ) );
  directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
  directionalLight.position.set( 500, 0, 500 );
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 200;
  directionalLight.shadow.camera.far = 1500;
  directionalLight.shadow.camera.left = - 500;
  directionalLight.shadow.camera.right = 500;
  directionalLight.shadow.camera.top = 500;
  directionalLight.shadow.camera.bottom = - 500;
  directionalLight.shadow.bias = - 0.005;
  scene.add( directionalLight );

  //
  loader = new THREE.GLTFLoader();
  loader.load( "threejs/LeePerrySmith.glb", function ( gltf ) {
    createScene( gltf.scene.children[ 0 ].geometry, 100 );
  } );
  //
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  container.appendChild( renderer.domElement );
  renderer.shadowMap.enabled = true;
  renderer.autoClear = false;
  //
  renderer.gammaInput = true;
  renderer.gammaOutput = true;
  //

    stats = new Stats();
    container.appendChild( stats.dom );
  // COMPOSER
  renderer.autoClear = false;
  // BECKMANN
  var effectBeckmann = new THREE.ShaderPass( THREE.ShaderSkin[ "beckmann" ] );
  var effectCopy = new THREE.ShaderPass( THREE.CopyShader );
  effectCopy.renderToScreen = true;
  var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };
  var rtwidth = 512, rtheight = 512;
  composerBeckmann = new THREE.EffectComposer( renderer);//, new THREE.WebGLRenderTarget( rtwidth, rtheight, pars ));
  composerBeckmann.addPass( effectBeckmann );
  composerBeckmann.addPass( effectCopy );

  composerBeckmann.addPass(bloomPass);
  composerBeckmann.addPass(new THREE.RenderPass( scene, camera ));
  composerBeckmann.setSize( window.innerWidth, window.innerHeight );

  //orbit controls
  controls = new THREE.OrbitControls( camera, renderer.domElement );


}



function createScene( geometry, scale ) {
  var textureLoader = new THREE.TextureLoader();
  var mapHeight = textureLoader.load( "threejs/Infinite-Level_02_Disp_NoSmoothUV-4096.jpg" );
  mapHeight.anisotropy = 4;
  mapHeight.wrapS = mapHeight.wrapT = THREE.RepeatWrapping;
  mapHeight.format = THREE.RGBFormat;
  var mapSpecular = textureLoader.load( "threejs/Map-SPEC.jpg" );
  mapSpecular.anisotropy = 4;
  mapSpecular.wrapS = mapSpecular.wrapT = THREE.RepeatWrapping;
  mapSpecular.format = THREE.RGBFormat;
  var mapColor = textureLoader.load( "threejs/Map-COL.jpg" );
  mapColor.anisotropy = 4;
  mapColor.wrapS = mapColor.wrapT = THREE.RepeatWrapping;
  mapColor.format = THREE.RGBFormat;
  var shader = THREE.ShaderSkin[ "skinSimple" ];
  var fragmentShader = shader.fragmentShader;
  var vertexShader = shader.vertexShader;
  var uniforms = THREE.UniformsUtils.clone( shader.uniforms );
  uniforms[ "enableBump" ].value = true;
  uniforms[ "enableSpecular" ].value = true;
  uniforms[ "tBeckmann" ].value = composerBeckmann.renderTarget1.texture;
  uniforms[ "tDiffuse" ].value = mapColor;
  uniforms[ "bumpMap" ].value = mapHeight;
  uniforms[ "specularMap" ].value = mapSpecular;
  uniforms[ "diffuse" ].value.setHex( 0xa0a0a0 );
  uniforms[ "specular" ].value.setHex( 0xa0a0a0 );
  uniforms[ "uRoughness" ].value = 0.2;
  uniforms[ "uSpecularBrightness" ].value = 0.5;
  uniforms[ "bumpScale" ].value = 8;
  var material = new THREE.ShaderMaterial( { fragmentShader: fragmentShader, vertexShader: vertexShader, uniforms: uniforms, lights: true } );
  material.extensions.derivatives = true;
  mesh = new THREE.Mesh( geometry, material );
  mesh.position.y = - 50;
  mesh.scale.set( scale, scale, scale );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add( mesh );

  //creating the window pane Group
  windowPane = new THREE.Group();
  windowsCreation();
  woodCreation();
  scene.add(windowPane);
  eyeCreation();
  refractionCreation();
  createParticleSystem();
}

function windowsCreation(){
  //creating the windows
  var windowGeometry = new THREE.PlaneGeometry(800,800,800);
  var windowMaterial = new THREE.MeshBasicMaterial({color: 0x6083c2, side: THREE.DoubleSide});
  windowMaterial.transparent = true;//allows the window to be see through
  windowMaterial.opacity = 0.4; //controls the level of transparency
  var windowTransparent = new THREE.Mesh(windowGeometry, windowMaterial); //front wondow
  var windowGeometryBack = new THREE.PlaneGeometry(830,830,830);
  var windowTransparentBack = new THREE.Mesh(windowGeometryBack, windowMaterial); //beck window

  //setting the position of the windows
  windowTransparentBack.position.set(0,0,-350);
  windowTransparent.position.set(0,0,500);

  //adding the windows
  windowPane.add(windowTransparent);
  windowPane.add(windowTransparentBack);
}


function woodCreation(){
  //wood texture constant used for all window creation
  var woodTexture = new THREE.TextureLoader().load("threejs/crate.gif");
  var woodMaterial = new THREE.MeshBasicMaterial({map: woodTexture});

  //top of window creation and addition
  var topWindow = new THREE.BoxGeometry(900,30,900);
  var windowWoodTop = new THREE.Mesh(topWindow, woodMaterial);
  windowWoodTop.position.set(0,430,100);
  windowPane.add(windowWoodTop);

  //bottom of window creation and addition
  var bottomWindow = new THREE.BoxGeometry(900,30,900);
  var windowWoodBottom = new THREE.Mesh(bottomWindow, woodMaterial);
  windowWoodBottom.position.set(0,-430,100);
  windowPane.add(windowWoodBottom);

  //leftside of window creation
  var leftWindow = new THREE.BoxGeometry(30,900,900);
  var windowWoodLeftSide = new THREE.Mesh(leftWindow, woodMaterial);
  windowWoodLeftSide.position.set(-430,0,100);
  windowPane.add(windowWoodLeftSide);

  //rightside of window reation
  var rightWindow = new THREE.BoxGeometry(30,900,900);
  var windowWoodRightSide = new THREE.Mesh(rightWindow, woodMaterial);
  windowWoodRightSide.position.set(430,0,100);
  windowPane.add(windowWoodRightSide);


  //Windows left edge creation and addition
  var windowLeftEdge = new THREE.BoxGeometry(30,800,20);
  var windowWoodLeftEdge = new THREE.Mesh(windowLeftEdge, woodMaterial);
  windowWoodLeftEdge.position.set(-400,0,500);
  windowPane.add(windowWoodLeftEdge);

  //window right edge creation and addition
  var windowRightEdge = new THREE.BoxGeometry(30,800,20);
  var windowWoodRightEdge = new THREE.Mesh(windowRightEdge, woodMaterial);
  windowWoodRightEdge.position.set(400,0,500);
  windowPane.add(windowWoodRightEdge);

  //window top edge creation and addition
  var windowTopEdge = new THREE.BoxGeometry(830,30,20);
  var windowWoodTopEdge = new THREE.Mesh(windowTopEdge, woodMaterial);
  windowWoodTopEdge.position.set(0,400,500);
  windowPane.add(windowWoodTopEdge);

  //window bottom edge creation and addition
  var windowBottomEdge = new THREE.BoxGeometry(830,30,20);
  var windowWoodBottomEdge = new THREE.Mesh(windowBottomEdge, woodMaterial);
  windowWoodBottomEdge.position.set(0,-400,500);
  windowPane.add(windowWoodBottomEdge);
}

function eyeCreation(){
  //creating the eye groups
  var leftEye = new THREE.Group();
  var rightEye = new THREE.Group();
  var eyes = new THREE.Group();

  //pupil creation
  var pupil = new THREE.SphereGeometry(10,32,32);
  var pupilMaterial = new THREE.MeshBasicMaterial({color: 0x000000});//, specular: 0x050505,shininess: 100});


  //iris creation
  var iris = new THREE.SphereGeometry(16,32,32);
  var irisMaterial = new THREE.MeshBasicMaterial({color: 0x8B0000});//, specular: 0x050505,shininess: 100});


  //sclera creation
  var sclera = new THREE.SphereGeometry(32,32,32);
  var scleraMaterial = new THREE.MeshBasicMaterial({color: 0xFFFFFF});//, specular: 0x050505,shininess: 100});

  //left eye creation
  var pupilMeshLeftEye = new THREE.Mesh(pupil, pupilMaterial);
  pupilMeshLeftEye.position.set(-70,120,213);
  var irisMeshLeftEye = new THREE.Mesh(iris, irisMaterial);
  irisMeshLeftEye.position.set(-70,120,205);
  var scleraMeshLeftEye = new THREE.Mesh(sclera, scleraMaterial);
  scleraMeshLeftEye.position.set(-70,120,185);

  //right eye creation
  var pupilMeshRightEye = new THREE.Mesh(pupil, pupilMaterial);
  pupilMeshRightEye.position.set(45,120,213);
  var irisMeshRightEye = new THREE.Mesh(iris, irisMaterial);
  irisMeshRightEye.position.set(45,120,205);
  var scleraMeshRightEye = new THREE.Mesh(sclera, scleraMaterial);
  scleraMeshRightEye.position.set(45,120,185);


  //left eye addition
  leftEye.add(pupilMeshLeftEye);
  leftEye.add(irisMeshLeftEye);
  leftEye.add(scleraMeshLeftEye);

  //right eye addition
  rightEye.add(pupilMeshRightEye);
  rightEye.add(irisMeshRightEye);
  rightEye.add(scleraMeshRightEye);

  //adding the eyes to one group
  eyes.add(leftEye);
  eyes.add(rightEye);

  //adding the groups to the scene
  scene.add(eyes);

}
function refractionCreation(){
  //refractor for the front window
  var refractorGeometry = new THREE.PlaneBufferGeometry( 800, 800 );
  var refractor = new THREE.Refractor( refractorGeometry, {color: 0x999999,textureWidth: 1024,textureHeight: 1024,shader: THREE.WaterRefractionShader} );
  refractor.position.set( 0, 0, 500 );
  scene.add( refractor );

  //refractor for the back window
  var refractorGeometryBack = new THREE.PlaneBufferGeometry( 800, 800 );
  var refractorBack = new THREE.Refractor( refractorGeometry, {color: 0x999999,textureWidth: 1024,textureHeight: 1024,shader: THREE.WaterRefractionShader} );
  refractorBack.position.set( 0, 0, -350 );
  scene.add( refractorBack );

}

function createParticleSystem(){
  //This will add a particle system to the scene
  var starsGeometry = new THREE.Geometry();

  for ( var i = 0; i < 1000; i ++ ) {
    var star = new THREE.Vector3();
    star.x = THREE.Math.randFloat(-400,400) * Math.sin(i);
    star.y = THREE.Math.randFloat(-1000,0) * Math.sin(THREE.Math.randFloat(0,-1))-400;
    star.z = THREE.Math.randFloat(-600,400)* Math.sin(THREE.Math.randFloat(0,-1));
    starsGeometry.vertices.push( star );
  }
  var starsMaterial = new THREE.PointsMaterial( { color: 0xFF0000 } );
  var starField = new THREE.Points( starsGeometry, starsMaterial );
  scene.add( starField );

}

function animate() {
  requestAnimationFrame( animate );

  var delta = clock.getDelta();
  tick += delta;
  if ( tick < 0 ) tick = 0;
  if ( delta > 0 && numParticleSystems < 3000) {
    createParticleSystem();
    numParticleSystems++;
  }

  composerBeckmann.render();
  stats.update();
}
