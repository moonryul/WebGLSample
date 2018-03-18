import { LightInfo, TextureInfo, GLSystem } from "./gl-system";
import { Renderer } from "./renderer";
import { Model, CreateSkybox, CreateSphere } from "./model";
import { Drawable } from "./drawable";
import { Camera } from "./camera";
import { vec3 } from "gl-matrix";
import * as Utils from "./utilities";
import { PreCompute } from "./pre-compute";

function EnableNeededExtensions(gl: WebGLRenderingContext): boolean {
  if (!gl.getExtension('OES_standard_derivatives')) {
    alert("OES_standard_derivatives is not supported!");
    return false;
  }
  if (!gl.getExtension('OES_texture_float')) {
    alert("OES_texture_float is not supported!");
    return false;
  }
  if (!gl.getExtension('OES_texture_float_linear')) {
    alert("OES_texture_float_linear is not supported!");
    return false;
  }

  return true;
}

function Main(canvasId: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const gl = canvas.getContext("webgl");
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  if (EnableNeededExtensions(gl) === false) {
    return;
  }

  const glSystem = new GLSystem(gl);
  const renderer = new Renderer(glSystem);

  const preCompute = new PreCompute(glSystem);
  preCompute.image = "assets/newport_loft.hdr";

  const pbr = Utils.CreatePbrProgram(glSystem);
  const skybox = Utils.CreateSkyboxProgram(glSystem);

  const light: LightInfo = {
    position: vec3.fromValues(75.0, 75.0, 100.0), 
    color: vec3.fromValues(500.0, 500.0, 500.0)
  };

  const camera = new Camera((45 * Math.PI / 180), (canvas.clientWidth / canvas.clientHeight));
  camera.HandleMouseInput(canvas);

  const ironSphereModel = CreateSphere();
  ironSphereModel.albedoMap = "assets/iron_albedo.png";
  ironSphereModel.normalMap = "assets/iron_normal.png";
  ironSphereModel.metallicMap = "assets/iron_metallic.png";
  ironSphereModel.roughnessMap = "assets/iron_roughness.png";
  ironSphereModel.aoMap = "assets/iron_ao.png";

  const ironSphere = new Drawable(ironSphereModel, glSystem);
  ironSphere.move([1.5, 0.0, -6.0]);

  const plasticSphereModel = CreateSphere();
  plasticSphereModel.albedoMap = "assets/plastic_albedo.png";
  plasticSphereModel.normalMap = "assets/plastic_normal.png";
  plasticSphereModel.metallicMap = "assets/plastic_metallic.png";
  plasticSphereModel.roughnessMap = "assets/plastic_roughness.png";
  plasticSphereModel.aoMap = "assets/plastic_ao.png";

  const plasticSphere = new Drawable(plasticSphereModel, glSystem);
  plasticSphere.move([-1.5, 0.0, -6.0]);

  const boxModel = CreateSkybox();
  const box = new Drawable(boxModel, glSystem);

  // const metallicSlider: any = document.getElementById("metallic");
  // metallicSlider.oninput = () => {
  //   // sphere.values.metallic = metallicSlider.value / 100.0;
  //   // console.log("metallic:" + sphere.values.metallic);
  // };

  // const roughnessSlider: any = document.getElementById("roughness");
  // roughnessSlider.oninput = () => {
  //   // sphere.values.roughness = roughnessSlider.value / 100.0;
  //   // console.log("roughness:" + sphere.values.roughness);
  // };

  let then = 0;
  // Draw the scene repeatedly
  const render = (now: number) => {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    ironSphere.rotate([0.0, deltaTime * 0.5, 0.0]);
    plasticSphere.rotate([0.0, deltaTime * 0.5, 0.0]);

    if (preCompute.isReady) {
      renderer.Clear();

      // scene 
      ironSphere.textures.irradianceMap = preCompute.irrMap;
      plasticSphere.textures.irradianceMap = preCompute.irrMap;
      renderer.Draw(camera, ironSphere, light, pbr);
      renderer.Draw(camera, plasticSphere, light, pbr);

      // skybox
      box.textures.envMap = preCompute.envMap;
      renderer.Draw(camera, box, null, skybox);
    } else {
      preCompute.update();
    }

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);

}

Main("glCanvas");
