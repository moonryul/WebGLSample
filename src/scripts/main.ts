import { LightInfo, TextureInfo, GLSystem } from "./gl-system";
import { Renderer } from "./renderer";
import { Model, CreateSkybox, CreateSphere, CreateQuad } from "./model";
import { Drawable } from "./drawable";
import { Camera } from "./camera";
import { vec3 } from "gl-matrix";
import * as Utils from "./utilities";
import { PreCompute } from "./pre-compute";

function SetIBLTextureToDrawable(drawable: Drawable, preCompute: PreCompute) {
  if (!drawable || !preCompute) {
    return;
  }

  //MJ: Apply IBL-related texture maps to some mesh to be drawn.
  drawable.textures.irradianceMap = preCompute.irrMap;
  drawable.textures.prefilterMap = preCompute.filMap;
  drawable.textures.brdfMap = preCompute.brdfMap;
}

function Main(canvasId: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  //MJ: At this context, document refer to the html document in which main.ts is mentioned

  const gl = canvas.getContext("webgl2");
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  const glSystem = new GLSystem(gl);
  if (!glSystem.isReliable) {
    return;
  }

  const renderer = new Renderer(glSystem); //MJ: renderer.Draw() executes gl.DrawElements() or gl.DrawArrays()

  const preCompute = new PreCompute(glSystem);

  preCompute.image = "assets/Mans_Outside_2k.hdr"; //MJ: Equi-rectangular map for the radiance map

  //MJ=> public set image(image: string) {

  //   this.state = State.LoadRadianceTexture;
  //   this.shpereMap = this.glSystem.CreateHDRTexture(image);
    
  // }

  //MJ: The file format also uses a clever trick to store each floating point value, not as a 32 bit value per channel,
  //  but 8 bits per channel using the color's alpha channel as an exponent (this does come with a loss of precision). 
  // This works quite well, but requires the parsing program to re-convert each color to their floating point equivalent.

  const pbr = Utils.CreatePbrProgram(glSystem); // MJ: The shader program for physically based rendering, using the precomputed IBL maps
  const pbrNoTextured = Utils.CreatePbrNoTexturedProgram(glSystem);
  const skybox = Utils.CreateSkyboxProgram(glSystem);

  const light: LightInfo = {
    position: vec3.fromValues(-10.0, 10.0, 10.0), 
    color: vec3.fromValues(300.0, 300.0, 300.0)
  };

  const camera = new Camera((45 * Math.PI / 180), (canvas.clientWidth / canvas.clientHeight));
  camera.HandleMouseInput(canvas);

  const goldSphere = Utils.CreateGoldenSphere(glSystem);
   //MJ: =>  const sphere = new Drawable(sphereModel, glSystem);
  const plasticSphere = Utils.CreatePlasticSphere(glSystem);
  const ironSphere = Utils.CreateIronSphere(glSystem);
  const sphere = Utils.CreateNoTexturedSphere(glSystem);

  const box = new Drawable(CreateSkybox(), glSystem);

  goldSphere.move([-1.1, 1.1, -8.0]);
  plasticSphere.move([-1.1, -1.1, -8.0]);
  ironSphere.move([1.1, -1.1, -8.0]);
  sphere.move([1.1, 1.1, -8.0]);

  // debug
  const debugTexture2D = Utils.CreateDebugTexture2DProgram(glSystem);

  //MJ: create a mesh to be drawn on the glSystem
  const quad = new Drawable(CreateQuad(), glSystem);

  // html elements
  const metallicSlider: any = document.getElementById("metallic");
  metallicSlider.oninput = () => {
    sphere.values.metallic = metallicSlider.value / 100.0;
  };

  const roughnessSlider: any = document.getElementById("roughness");
  roughnessSlider.oninput = () => {
    sphere.values.roughness = roughnessSlider.value / 100.0;
  };

  const aoSlider: any = document.getElementById("ao");
  aoSlider.oninput = () => {
    sphere.values.ao = aoSlider.value / 100.0;
  };

  const albedoCP: any = document.getElementById("albedo");
  albedoCP.addEventListener("change", (event: any) => {
    const hexColor = event.target.value;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    const r = parseInt(result[1], 16) / 255.0;
    const g = parseInt(result[2], 16) / 255.0;
    const b = parseInt(result[3], 16) / 255.0;
    sphere.values.albedo = vec3.fromValues(r, g, b);
  }, false);

  // Draw the scene repeatedly
  let then = 0;
  let pbrImageSetted = false;

  const render = (now: number) => {

    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    //MJ: Each time the example meshes for testing PBR rendering, move these objects.
    ironSphere.rotate([0.0, deltaTime * 0.1, 0.0]);
    goldSphere.rotate([0.0, deltaTime * 0.1, 0.0]);
    plasticSphere.rotate([0.0, deltaTime * 0.1, 0.0]);

    if (preCompute.isReady) {

      if (!pbrImageSetted) {
        //MJ: Set the IBL related texture maps to ironShpere, goldSphere, plasticSphere, and sphere drawables
        SetIBLTextureToDrawable(ironSphere, preCompute);
        SetIBLTextureToDrawable(goldSphere, preCompute);
        SetIBLTextureToDrawable(plasticSphere, preCompute);
        SetIBLTextureToDrawable(sphere, preCompute);

        //MJ: SetIBLTextureToDrawable(ironSphere, preCompute):  
        // Apply IBL-related texture maps to some mesh to be drawn.
            //  drawable.textures.irradianceMap = preCompute.irrMap;
            //  drawable.textures.prefilterMap = preCompute.filMap;
            //  drawable.textures.brdfMap = preCompute.brdfMap;

        //MJ: assign irrMap, filMap, and brdfMap to ironSphere, goldSphere, plasticSphere, sphere. 
        //MJ: But, set only the envMap to the box drawable; for what purpose ?? 
        box.textures.envMap = preCompute.envMap; 
        pbrImageSetted = true;
      }

      renderer.Clear();
      // scene 
      //MJ: renderer.Draw() executes gl.DrawElements() or gl.DrawArrays()
      //MJ: light = positional light:

      // const light: LightInfo = {
      //   position: vec3.fromValues(-10.0, 10.0, 10.0), 
      //   color: vec3.fromValues(300.0, 300.0, 300.0)
      // };

      renderer.Draw(camera, ironSphere, light, pbr);
      renderer.Draw(camera, goldSphere, light, pbr);
      renderer.Draw(camera, plasticSphere, light, pbr);
      renderer.Draw(camera, sphere, light, pbrNoTextured);
      // skybox
      renderer.Draw(camera, box, null, skybox);

      // debug
      // gl.viewport(0, 0, 512, 512);
      // quad.textures.texture2D = preCompute.brdfMap;
      // renderer.Draw(camera, quad, null, debugTexture2D);

    } //if (preCompute.isReady)
     else {

      preCompute.update(); //MJ: precompute the four IBL related maps in a state sequence
    }

    requestAnimationFrame(render);
  };
  //def render()

  requestAnimationFrame(render);

  //MJ
//   The requestAnimationFrame function is a native browser API for performing animations efficiently. 
//   It takes as an argument a callback function, in this case, render, 
//   which it schedules to be called before the next repaint or redraw of the browser's window.

//   In the context of the provided code, requestAnimationFrame(render); is essentially telling the browser:
//    "Hey, before you do your next screen redraw, please execute the render function". 
//    This is commonly seen in the initialization of animation or game loops, 
//   where the render function will update the scene, draw it, and then request the next frame.

//   Here's what it means in the context of the provided code:

// Efficient Animations: Instead of using a regular setTimeout or setInterval to run an animation loop, 
// requestAnimationFrame is designed to be more efficient. It can sync with the refresh rate of the device's display, 
// typically 60Hz (but it may vary). This results in smoother animations.

// Callback Execution: When requestAnimationFrame(render); is called, the render function will be executed
//  before the next redraw of the screen. This is typically used in animation loops.
//   For instance, if you're animating a game or a visual simulation in a browser,
//    you might find the render function itself calling requestAnimationFrame again, creating a loop.

// Paused in Background: Another advantage of requestAnimationFrame is 
// that it's paused when the browser tab is not active, ensuring that
//  unnecessary computations aren't being done in the background, which can be a wasteful use of resources.

// Optimization: The browser can optimize concurrent animations to batch them together,
//  resulting in less overall work and smoother animations.

} // function Main(canvasId: string)


Main("glCanvas");
//MJ: THe main entry point of the main.ts; 
//  It is assumed that canvas id "glCanvas" is defined in the html document in which
// main.ts is defined.
//  <body>
//        <canvas id="glCanvas" width="800" height="600"></canvas>

// from index.html:

// <!DOCTYPE html>
// <html>
//     <head>
//         <meta charset="UTF-8" />
//         <title>WebGL Sample</title>
//         <link rel="stylesheet" href="sample.css" type="text/css">
//     </head>
//     <body>
//         <canvas id="glCanvas" width="800" height="600"></canvas>
//         <div class="slidecontainer">
//             <div>Metallic:</div>
//             <input type="range" min="1" max="100" value="50" class="slider" id="metallic">
//             <br/>
//             <div>Roughness:</div>
//             <input type="range" min="1" max="100" value="50" class="slider" id="roughness">
//             <br/>
//             <div>AO:</div>
//             <input type="range" min="1" max="100" value="50" class="slider" id="ao">
//             <br/>
//             <div>Albedo:</div>
//             <input type="color" value="#ffffff" class="picker" id="albedo">
//             <br/>
//         </div>
//         <script src="bundle.js"></script>
// MJ:   // MJ: src/scripts/main.ts' is bundled into bundle.js, and main.ts refers to "glCanvas" as the main DOM element to render on
//     </body>
// </html>
