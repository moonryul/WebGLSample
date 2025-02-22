import * as _ from "lodash";
import { mat4, vec3 } from "gl-matrix";
import { LightInfo, TextureInfo, VertexInfo, GLSystem } from "./gl-system";
import { Program } from "./program";
import { Drawable } from "./drawable";
import { Camera } from "./camera";
import { PrimitiveMode, DataType, TextureType } from "./model";

export class Renderer {

  public constructor(private glSystem: GLSystem) { }

  //MJ:  this.SetupOtherUniforms(camera, drawable, light, program) is called in Draw() method:
  private SetupOtherUniforms(camera: Camera, drawable: Drawable, light: LightInfo, program: Program): void {

    if (!camera || !drawable || !program) {
      return;
    }

    const gl = this.glSystem.context;

    //MJ: Set the Uniform variables of program
    _.map(program.uniformNames, (name: string) => {
      const id = name.substring(2);

      let value = undefined;
      let type = undefined;
      switch (id) {

        case "viewProjMatrix": 
          value = camera.viewProjMatrix;
          type = DataType.Float4x4;
          break;

        case "modelMatrix": 
          value = drawable.modelMatrix;
          type = DataType.Float4x4;
          break;

        case "normalMatrix": 
          value = drawable.normalMatrix;
          type = DataType.Float3x3;
          break;

        case "viewMatrix":
          value = camera.viewMatrix;
          type = DataType.Float4x4;
          break;

        case "projMatrix":
          value = camera.projMatrix;
          type = DataType.Float4x4;
          break;

        case "viewPos":
          value = camera.eye;
          type = DataType.Float3;
          break;

        case "lightPos":
          value = light.position;
          type = DataType.Float3;
          break;

        case "lightColor":
          value = light.color;
          type = DataType.Float3;
          break;

        case "albedo":
          value = drawable.values.albedo;
          type = DataType.Float3;
          break;

        case "metallic":
          value = drawable.values.metallic;
          type = DataType.Float;
          break;

        case "roughness":
          value = drawable.values.roughness;
          type = DataType.Float;
          break;

        case "ao":
          value = drawable.values.ao;
          type = DataType.Float;
          break;

        default:
          break;
      }

      if (value != undefined && value != null) {
        program.SetUniform(name, value, type);
      } else {
        console.error("Uniform " + id + " not found in drawable!");
      }
    });
    // MJ: Set the Uniform variables of program
  }//private SetupOtherUniforms

  public Clear() {

    const gl = this.glSystem.context;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
  
    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  public Draw(camera: Camera, drawable: Drawable, light: LightInfo, program: Program): void {
    if (!camera || !drawable || !program || !program.isReady) {
      return;
    }

    const gl = this.glSystem.context;

    // Tell WebGL to use our program when drawing
    program.Use();

    const vertexInfo = drawable.vertex;

    // set attributes
    if (!program.CheckAttribLocation(vertexInfo.layouts)) {
      console.error("Check drawable vertex info failed!");
    }

    gl.bindVertexArray(vertexInfo.vao);

    // set textures to program
    _.map(program.textureNames, (id: string) => {
      const name = id.substring(2);
      const textureInfo = drawable.textures[name];
      if (textureInfo) {
        program.SetTexture(id, textureInfo.texture, textureInfo.type);
      } else {
        console.error("Drawable texture:" + name + " not exsit");
      }
    });

    this.SetupOtherUniforms(camera, drawable, light, program);

    let mode = gl.TRIANGLES;
    switch(drawable.primitiveMode) {
      case PrimitiveMode.TriangleStrip: mode = gl.TRIANGLE_STRIP; break;
      case PrimitiveMode.TriangleFan: mode = gl.TRIANGLE_FAN; break;
      default: break;
    }

    if (vertexInfo.ebo) {
      const vertexCount = vertexInfo.count;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(mode, vertexCount, type, offset);
    } else {
      const vertexCount = vertexInfo.count;
      const first = 0;
      gl.drawArrays(mode, first, vertexCount);
    }

    gl.bindVertexArray(null); // MJ: reset gl.bindVertexArray(vertexInfo.vao);
  }//public Draw(camera: Camera, drawable: Drawable, light: LightInfo, program: Program)

} // export class Renderer
