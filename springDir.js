app.directive('spring', function($parse, $log, $timeout) {
  return {
    restrict: "EA",
    template: '<div id="webgl-container" class="centred"></div>',

    // MUST use this scope, which is an isolated child scope, but still possess two-way binding? Still unclear how this works exactly. Will
    //continue to learn about it. But for now, this will allow you to 
    scope: {
      ballDataSpring: '='
    },

    link: function(scope, elem, attrs) {

      //parses all the data found in the attribute ball-data-spring, in this case it will grab the data represeted by
      //ballX in the controller
      //Parse creates a function of sorts, which can be fed a specific scope? Not 100% sure, need to read more.
      var exp = $parse(attrs.ballDataSpring);

      //saving the data to a variable, it returns the data, probably done so that you don't have to feed 
      //scope back into the data. not super important
      // To get to the parent scope (ie. whats in the controller), you have to feed in scope.$parent, otherwise it tries to use the children scope, which doesn't have
      // any properties.
      var ballData = exp(scope.$parent);

      //need to define the variable container so that we can match it with the draggable example. 
      var container = document.getElementById("webgl-container");

      // Variables to make the mouse tracking work.
      var objects = [],
        plane;
      var raycaster = new THREE.Raycaster();
      var mouse = new THREE.Vector2(),
        //might not need the offset in 3 dimensions. only moving it in 2...
        offset = new THREE.Vector3(),
        INTERSECTED, SELECTED;
      var currentMouse;
      //max stretch on spring
      var maxMouse = 1.9;
      //break Point on spring
      var breakPoint = 2.5;
      //min compress on spring
      var minMouse = 0.1;
 
      //Add the property isDown to mouse, in order to pause the animation
      mouse.isDown = false;
      var brokenSpring = false;
      var counter = 0;
      var brokenFrames = 60;

      var spring;
      var invisSphere;

      var fullSpring = 0;
      var compressSpring = 1;


      //define variables for the scene. Define previous so that you can remove the object. Define material so you can load
      // it onto the sphere. 
      var scene = new THREE.Scene(),
        light = new THREE.PointLight(0xffffff),
        camera,
        renderer = new THREE.WebGLRenderer({
          alpha: true //need alpha to be true to change colour of background
        }),
        sphere,
        stats,
        previous,
        material;

      // no need for window.onload because this directive is loaded after assets are loaded.
      // using window.onload calls two instances of THREE, which cause the camera to break.
      initScene();


      // call the animate function. This was copied from the fuckingdevelopers demo on angular and Three.JS
      animate();

      // this function sets up the original container and the light sources ect. 


      function initScene() {

        var width = 600;
        var height = 100;

        // setup renderer
        renderer.setSize(width, height);
        // To get the white background
        renderer.setClearColor(0xffffff, 1);

        container.appendChild(renderer.domElement);

        var lights = [];
        lights[0] = new THREE.PointLight(0xdddddd, 1, 0);
        //lights[1] = new THREE.PointLight(0xffffff, 1, 0);
       // lights[2] = new THREE.PointLight(0x9c00ff, 1, 300);
        lights[3] = new THREE.AmbientLight(0xc1c1c1);

        lights[0].position.set(0, 200, 0);
        //lights[1].position.set(100, 200, 100);
        // lights[2].position.set(100, -200, -100);

        scene.add(lights[0]);
        //scene.add(lights[1]);
        //scene.add(lights[2]);
        scene.add(lights[3]);


        camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        1,
        1000
        );
        camera.position.z = 300;
        scene.add(camera);

       
        ///add a plane to the scene to make sure mouse controls work. Will need to look into how this works exactly. 
        plane = new THREE.Mesh(
          new THREE.PlaneBufferGeometry(500, 500),
          new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0.25,
            transparent: true
          })
        );
        plane.visible = false;
        scene.add(plane);


        ///////////
        ///Sphere//
        ///////////
   
        var sphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x0000ff,
        ambient: 0x0000ff,
        transparent: true,
        opacity: 0.95,
        });
        var sphereGeo = new THREE.SphereGeometry(25, 32, 16);
        invisSphere = new THREE.Mesh(sphereGeo, sphereMaterial);
        invisSphere.visible = false;
        
        scene.add(invisSphere);       
        objects.push(invisSphere); 

        ///////////
        ///Spring//
        ///////////

        //Loading the model. In this case we loaded a spring
        // the spring was animated used shape keys, and a very simple material was added.

        var jsonLoader = new THREE.JSONLoader();
        jsonLoader.load("springAni.json", addModelToScene);
        // addModelToScene function is called back after model has loaded
        // 
        // 
        // 
        // 
        
        ///////////
        //  TEXT //
        ///////////
        // create a canvas element
        var canvas1 = document.createElement('canvas');
        var context1 = canvas1.getContext('2d');
        context1.font = "Bold 14px Tahoma";
        context1.fillStyle = "rgba(0,0,0,0.95)";
        context1.fillText('Click refresh to restart simulation', 0, 20);
      
        // canvas contents will be used for a texture
        var texture1 = new THREE.Texture(canvas1) 
        texture1.needsUpdate = true;
        //set this to LinearFilter to prevent warning.
        texture1.minFilter = THREE.LinearFilter;
              
        var material1 = new THREE.MeshBasicMaterial( {map: texture1, side:THREE.DoubleSide} );
        material1.transparent = true;

        var mesh1 = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(canvas1.width, canvas1.height),
            material1
          );

        mesh1.name = "text";
        mesh1.position.set(width/8,-100,0);
        mesh1.visible = false;
        scene.add( mesh1 );
        


        //These are listening for clicks of the mouse on the screen.
        renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
        renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
        renderer.domElement.addEventListener('mouseup', onDocumentMouseUp, false);

        //might wanna add the eventListener soon.
        //window.addEventListener( 'resize', onWindowResize, false );
      }

      // this is for uploading the correct materials for the imported 3D asset
      // in this case, we loaded a JSON object from blender, the spring. 
      function addModelToScene(geometry, materials) {

        // for preparing animation, need to tell the materials to have the potential to morph between keyframes
        for (var i = 0; i < materials.length; i++)
          materials[i].morphTargets = true;

        // materials are definied in the JSON file for the 3D model. 
        var material = new THREE.MeshFaceMaterial(materials);
        spring = new THREE.Mesh(geometry, material);
        spring.scale.set(3.4, 3.4, 3.4);
        spring.rotation.z = (convert(-90))
        
        //need to come up with a good way of orienting the spring
        // the length of the spring is ~83
        spring.position.x = -77;

        scene.add(spring);

        //push in the spring to objects so you can detect when its selected
        //Use an invisible sphere the moves with the end of the spring.
        //objects.push(spring);
      }

      //quick function for converting degrees into radians.
      function convert(degree) {
        return degree * (Math.PI / 180);
      };



      //The below functions are for the movement of the balls. Have to adjust the mouse x and y to 
      //correspond to the current position of the mouse. 
      function onDocumentMouseMove(event) {
        event.preventDefault();

        // have to use the render.domElement.offset, in order to have the 3D assets anywhere on the page. 
        mouse.x = ((event.clientX - renderer.domElement.offsetLeft) / renderer.domElement.width) * 2 - 1;
        mouse.y = -((event.clientY - renderer.domElement.offsetTop) / renderer.domElement.height) * 2 + 1;

        // raycaster is the way of determining the selection. It is based on the mouse position and the camera angle within
        // the scene.
        raycaster.setFromCamera(mouse, camera);

        //if an object is selected, do what is inside this if statement
        if (SELECTED) {
          //why are we using the position on the plane to determine movement? This is for the offset, helps to normalize?
          // as you start moving the object, its coordinates change, causes issues?
          var intersects = raycaster.intersectObject(plane);

          // CHANGES THE MORPH OF THE SPRING BASED ON THE POSITION OF THE BALL
          // NOTE, for some reason, intersects[0].point.x has a starting value, and the 
          // if statement is run (even though SELECTED should be null). It seems that raycaster
          // initializes with an actual value. Don't know why.
          currentMouse = (intersects[0].point.x) / springLength;
          
          maxMouse = 1.9;
          
          breakPoint = 3;

          minMouse = 0.1;

          if (currentMouse > 0.1 && currentMouse <= maxMouse) {
            spring.morphTargetInfluences[1] = currentMouse; 
            spring.morphTargetInfluences[0] = 1 - currentMouse;
            springPhys.x = intersects[0].point.x;
            invisSphere.position.x = intersects[0].point.x;
          }
          else if (currentMouse > maxMouse && currentMouse <= breakPoint) {
            spring.morphTargetInfluences[1] = maxMouse; 
            spring.morphTargetInfluences[0] = 1-maxMouse;
            springPhys.x = maxMouse*springLength;
            invisSphere.position.x = maxMouse*springLength;
          }  
          else if (currentMouse > -0.5 && currentMouse <=minMouse) {
            spring.morphTargetInfluences[1] = minMouse; 
            spring.morphTargetInfluences[0] = 1 - minMouse;
            springPhys.x = minMouse*springLength;
            invisSphere.position.x = minMouse*springLength;
          }
          else if (currentMouse > breakPoint)
          {
            brokenSpring = true;
            springPhys.x = 245;
            SELECTED = null;
          }  
        }

        var intersects = raycaster.intersectObjects(objects);

        if (intersects.length > 0) {
          if (INTERSECTED != intersects[0].object) {
            INTERSECTED = intersects[0].object;
            plane.position.copy(INTERSECTED.position);
            plane.lookAt(camera.position);
          }
          container.style.cursor = 'pointer';
        } else {
          INTERSECTED = null;
          container.style.cursor = 'auto';
        }
      }



      function onDocumentMouseDown(event) {
        event.preventDefault();
        // var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
        // var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
        var intersects = raycaster.intersectObjects(objects);
        
        mouse.isDown = true;

        window.removeEventListener('mousedown', onDocumentMouseDown, false);
        window.addEventListener('mouseup', onDocumentMouseUp, false);

        if (intersects.length > 0) {
          SELECTED = intersects[0].object;
          var intersects = raycaster.intersectObject(plane);

          springPhys.v = 0;

          //offset.copy(intersects[0].point).sub(plane.position);
          container.style.cursor = 'move';

        }
      }

      function onDocumentMouseUp(event) {
        event.preventDefault();

        window.removeEventListener('mouseup', onDocumentMouseUp, false);
        window.addEventListener('mousedown', onDocumentMouseDown, false);
        
        mouse.isDown = false;
        
        if (INTERSECTED) {
          plane.position.copy(INTERSECTED.position);
        }
        SELECTED = null;
        container.style.cursor = 'auto';
      }

      function animate() {
        requestAnimationFrame(animate);
        render();
      }


      //from the spring physics, likely redundant with the animation. 
      // http://burakkanber.com/blog/physics-in-javascript-car-suspension-part-1-spring-mass-damper/

      var frameRate = 1 / 150;
      var frameDelay = frameRate * 1000;

      //The below variables are from the physics tutorial 
      // http://burakkanber.com/blog/physics-in-javascript-car-suspension-part-1-spring-mass-damper/
      /* Spring stiffness, in kg / s^2 */
      var k = -20;
      var springLength = 81; //equilibrium length

      /* Damping constant, in kg / s */
      var b = -0.3;

      /* springPhys position and velocity. */
      var springPhys = {
        x: 0,
        v: -3,
        mass: 1
      };


      function render() {

      //This function updates the scope variable, which is the x position of the springPhys  
      $timeout(function() {
        scope.$apply(function() {
            exp.assign(scope.$parent, springPhys.x);
          });
      });

      //if (false)

      if (spring && !mouse.isDown && !brokenSpring) // exists / is loaded 
      {
        // former way of determining the amount of the morph, need to switch to physics interpretation.
        // time = new Date().getTime() % duration;

        //Physics part of this code is taken from the physics tutorial http://burakkanber.com/blog/physics-in-javascript-car-suspension-part-1-spring-mass-damper/
        // eliminated mention of the wall, as it was not necessary for this. 

        // defines the force experienced by the spring. need spring length to equal equilibrium position.
        var F_spring = k * (springPhys.x - springLength);

        // defines the dampening force, it is always opposed to motion.

        if (Math.abs(springPhys.v) < 100) {
          var F_damper = 0;
        } else {
          var F_damper = b * springPhys.v;
        }
       
        //acceleraiton is the net force, divided by the mass of the spring/ball system
        var a = (F_spring + F_damper) / springPhys.mass;

        //this is the change in velocity at a certain time measure
        springPhys.v += a * frameRate;

        //this  is the change in position with respect to that time measure.
        springPhys.x += springPhys.v * frameRate;


        //INVISIBLE Sphere on top of the end of the spring. 
        //corrected so that it is right on tope of the animation
        invisSphere.position.x = springPhys.x-20;

        //convert this position into a specific morph
        var changeIn = springLength - springPhys.x;

        //changeFraction is a fractional number.
        var changeFraction = changeIn / springLength;

        spring.morphTargetInfluences[1] =
          1 - changeFraction;
        spring.morphTargetInfluences[0] =
          1 - spring.morphTargetInfluences[1];        
      }

      brokenFrames = 25;
      var morphZeroFinal = 0;
      var morphOneFinal = 0;
      var morphTwoFinal = 1;
      var morphZeroChange = (morphZeroFinal - (1-maxMouse))/brokenFrames;
      var morphOneChange = (morphOneFinal - (maxMouse))/brokenFrames;
      var morphTwoChange = (morphTwoFinal - 0)/brokenFrames;

      if (brokenSpring && counter < brokenFrames) {

        objects = [];
      
        counter += 1;
        spring.morphTargetInfluences[0] = 1-maxMouse + counter*morphZeroChange;
        spring.morphTargetInfluences[1] = maxMouse + counter*morphOneChange;
        spring.morphTargetInfluences[2] = 0 + counter*morphTwoChange;

        //append button that says click here to refresh.
      } 
      else if (counter >= brokenFrames) {
          var selectText = scene.getObjectByName("text");
          selectText.visible = true;
      }

        renderer.render(scene, camera);
      }

      return {
        scene: scene,
      }
    }
  }
});