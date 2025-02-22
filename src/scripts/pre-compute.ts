import * as _ from "lodash";
import { vec3, mat4 } from "gl-matrix";
import { TextureInfo, GLSystem, IsPOT } from "./gl-system";
import { Program } from "./program";
import { DataType, TextureType, CreateSkybox, CreateQuad } from "./model";
import { Drawable } from "./drawable";

enum State {
  PrepareRenderObjects,
  LoadRadianceTexture,
  ConvertToEnvironmentMap,
  CalculateIrradianceMap,
  CalculatePreFilterMap,
  GenerateBRDFLookUpMap,
  Finished
}

//MJ:
//IBL, or image based lighting, is a collection of techniques to light objects, not by direct analytical lights,
 //but by treating the surrounding environment as one big light source. 

export class PreCompute {

  private state: State;

  // These are geometries to be used to render cubemaps.
  private unitCube: Drawable;
  private unitQuad: Drawable;

  private rad2envProgram: Program;
  private env2irrProgram: Program;
  private env2filProgram: Program;
  private brdfGenProgram: Program;

  private envSize: number;
  private irrSize: number;
  private filSize: number;
  private lutSize: number;

  private envCubeMap: WebGLTexture;
  private irrCubeMap: WebGLTexture;
  private filCubeMap: WebGLTexture;
  private brdfLutMap: WebGLTexture;

  private cubemapTargets: number[];
  private viewProjMatrixes: mat4[];

  // temp properties
  private shpereMap: TextureInfo;
  private captureFBO: WebGLFramebuffer;
  private captureCBO: WebGLRenderbuffer;  // color buffer
  private captureDBO: WebGLRenderbuffer;  // depth buffer

  public constructor(private glSystem: GLSystem) {
    this.unitCube = null;
    this.shpereMap = null;

    this.rad2envProgram = null;
    this.env2irrProgram = null;
    this.env2filProgram = null;
    this.brdfGenProgram = null;

    this.envSize = 1024;
    this.irrSize = 32;
    this.filSize = 128;
    this.lutSize = 512;

    this.envCubeMap = null;
    this.irrCubeMap = null;
    this.filCubeMap = null;
    this.brdfLutMap = null;

    const gl = this.glSystem.context;

    this.cubemapTargets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    const ToRadians = (angle: number) => {
      return angle * (Math.PI / 180.0);
    };
    const projection = mat4.perspective(mat4.create(), ToRadians(90.0), 1.0, 0.1, 10.0);

    this.viewProjMatrixes = [
      mat4.multiply(mat4.create(), projection, mat4.lookAt(mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 1.0, 0.0, 0.0), vec3.fromValues(0.0,-1.0, 0.0))),
      mat4.multiply(mat4.create(), projection, mat4.lookAt(mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues(-1.0, 0.0, 0.0), vec3.fromValues(0.0,-1.0, 0.0))),
      mat4.multiply(mat4.create(), projection, mat4.lookAt(mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0, 1.0, 0.0), vec3.fromValues(0.0, 0.0, 1.0))),
      mat4.multiply(mat4.create(), projection, mat4.lookAt(mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,-1.0, 0.0), vec3.fromValues(0.0, 0.0,-1.0))),
      mat4.multiply(mat4.create(), projection, mat4.lookAt(mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0, 0.0, 1.0), vec3.fromValues(0.0,-1.0, 0.0))),
      mat4.multiply(mat4.create(), projection, mat4.lookAt(mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0, 0.0,-1.0), vec3.fromValues(0.0,-1.0, 0.0)))
    ];

    this.captureFBO = null;
    this.captureCBO = null;
    this.captureDBO = null;

    //MJ: create the four shader programs for rendering the IBL related maps  
    this.PrepareRenderObjects();
  }//public constructor(private glSystem: GLSystem)

  public get isReady(): boolean { return (this.state === State.Finished); }

  public get envMap(): TextureInfo { 
    return {
      texture: this.envCubeMap,
      type: TextureType.TextureCubeMap,
      width: this.envSize,
      height: this.envSize
    }; 
  }

  public get irrMap(): TextureInfo { 
    return {
      texture: this.irrCubeMap,
      type: TextureType.TextureCubeMap,
      width: this.irrSize,
      height: this.irrSize
    }; 
  }

  public get filMap(): TextureInfo {
    return {
      texture: this.filCubeMap,
      type: TextureType.TextureCubeMap,
      width: this.filSize,
      height: this.filSize
    }; 
  }

  public get brdfMap(): TextureInfo {
    return {
      texture: this.brdfLutMap,
      type: TextureType.Texture2D,
      width: this.lutSize,
      height: this.lutSize
    }; 
  }

  public set image(image: string) {

    this.state = State.LoadRadianceTexture;
    this.shpereMap = this.glSystem.CreateHDRTexture(image);

  }

  //MJ: Pre-compute all the IBL related maps in a state sequence
  public update() {

    switch (this.state) {
      case State.LoadRadianceTexture: {
        if (this.shpereMap && this.shpereMap.texture
            && this.rad2envProgram.isReady) { // MJ: check if the shader program for rendering EnvCubeMap is ready
          this.RenderToEnvCubemap();
        }
        break;
      }

      case State.CalculateIrradianceMap: {
        if (this.env2irrProgram.isReady) {
          this.RenderToIrrCubemap();
        }
        break;
      }

      case State.CalculatePreFilterMap: {
        if (this.env2filProgram.isReady) {
          this.RenderToPreFilterMap();
        }
        break;
      }

      case State.GenerateBRDFLookUpMap: {
        if (this.brdfGenProgram.isReady) {
          this.RenderToBDRFMap();
        }
        break;
      }

      default:
        break;
    }
  }

  private ClearCubemap() {
    const gl = this.glSystem.context;
    if (this.envCubeMap) { gl.deleteTexture(this.envCubeMap); }
    if (this.irrCubeMap) { gl.deleteTexture(this.irrCubeMap); }
    this.envCubeMap = null;
    this.irrCubeMap = null;
  }

  private PrepareRenderObjects() {
    this.state = State.PrepareRenderObjects;

    const gl = this.glSystem.context;

    // create shader programs
    this.rad2envProgram = new Program(this.glSystem, {
      vertFile: "assets/shaders/pre-computer/unitCube.vs",
      fragFile: "assets/shaders/pre-computer/rad2env.fs",
      uniforms: {
        textures: { "u_sphereMap": TextureType.Texture2D },
        others: { "u_viewProjMatrix": DataType.Float4x4 }
      }
    });

    this.env2irrProgram = new Program(this.glSystem, {
      vertFile: "assets/shaders/pre-computer/unitCube.vs",
      fragFile: "assets/shaders/pre-computer/env2irr.fs",
      uniforms: {
        textures: { "u_envMap": TextureType.TextureCubeMap },
        others: { "u_viewProjMatrix": DataType.Float4x4 }
      }
    });

    this.env2filProgram = new Program(this.glSystem, {
      vertFile: "assets/shaders/pre-computer/unitCube.vs",
      fragFile: "assets/shaders/pre-computer/env2fil.fs",
      uniforms: {
        textures: { "u_envMap": TextureType.TextureCubeMap },
        others: { 
          "u_viewProjMatrix": DataType.Float4x4,
          "u_roughness": DataType.Float,
          "u_resolution": DataType.Float
        }
      }
    });

    this.brdfGenProgram = new Program(this.glSystem, {
      vertFile: "assets/shaders/pre-computer/brdf.vs",
      fragFile: "assets/shaders/pre-computer/brdf.fs",
      uniforms: { textures: { }, others: { } }
    });

    // load model
    const cube = CreateSkybox();
    this.unitCube = new Drawable(cube, this.glSystem);

    const quad = CreateQuad();
    this.unitQuad = new Drawable(quad, this.glSystem);
  }//private PrepareRenderObjects()

  private CreateCubeMap(size: number, mipmap: boolean = false): WebGLTexture {
    const gl = this.glSystem.context;

    const level = 0;
    const internalFormat = gl.RGBA16F;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.FLOAT;

    const cubeMap = gl.createTexture();
    //MJ: => glGenTextures(1, &hdrTexture);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap); 
//MJ: bind the current active texture map, cubeMap to target, gl.TEXTURE_CUBE_MAP, cubeMap); //MJ: bind the current active texture map, cubeMap to target, 

//MJ:In OpenGL, "target" is used to specify the type or category of texture you are working with. 
// There are several texture targets in OpenGL, and each represents a different kind or category of texture.

// Some common texture targets are:

// GL_TEXTURE_2D: This is for regular 2D textures.
// GL_TEXTURE_3D: This is for 3D textures.
// GL_TEXTURE_CUBE_MAP: This is for cube-mapped textures, often used for environment maps.

// When you call glBindTexture(target, texture), you are setting the active texture for a specific target or type.
//  Once a texture is bound to a target, subsequent OpenGL commands that operate on textures will use the texture 
//  that's bound to that target.

// So, when you bind a texture with glBindTexture(GL_TEXTURE_2D, hdrTexture), the target is GL_TEXTURE_2D 
// (indicating it's a 2D texture), and hdrTexture is the ID of the texture you're binding.
//  All subsequent operations that apply to a 2D texture will apply to hdrTexture 
//  until another texture is bound to the GL_TEXTURE_2D target or the target is unbound.



    for (let i = 0; i < this.cubemapTargets.length; ++i) {

      gl.texImage2D(this.cubemapTargets[i], level, internalFormat, size, size, border, srcFormat, srcType, null);
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (mipmap === true && IsPOT(size)) {
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    }

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

    return cubeMap;
  } //private CreateCubeMap()


  private RenderToCubeMap(target: WebGLTexture, program: Program, mipLevel: number = 0) {
    const gl = this.glSystem.context;

    const vertexInfo = this.unitCube.vertex;
    gl.bindVertexArray(vertexInfo.vao);

    for (let i = 0; i < this.cubemapTargets.length; ++i) {

      program.SetUniform("u_viewProjMatrix", this.viewProjMatrixes[i], DataType.Float4x4);

      gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.cubemapTargets[i], target, mipLevel);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.drawElements(gl.TRIANGLES, vertexInfo.count, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindVertexArray(null);
  }

  //MJ:
  // one way of representing an environment or scene's irradiance is in the form of a (processed) environment cubemap. 
  // Given such a cubemap, we can visualize every texel of the cubemap as one single emitting light source.
  //  By sampling this cubemap with any direction vector wi,  we retrieve the scene's radiance from that direction.

  // By splitting the integral in two parts we can focus on both the diffuse and specular term individually; 
  // the focus of RenderToEnvCubemap() is on the diffuse integral.

  // By storing the convoluted result in each cubemap texel (in the direction of wo
  //   ), the irradiance map displays somewhat like an average color or lighting display of the environment. 
  //   Sampling any direction from this environment map
  //    will give us the scene's irradiance in that particular direction.
  private RenderToEnvCubemap() {

    this.state = State.ConvertToEnvironmentMap;

    this.ClearCubemap();

    const gl = this.glSystem.context;

    this.captureFBO = gl.createFramebuffer(); // MJ: framebuffer object
    this.captureCBO = gl.createRenderbuffer(); // MJ: color buffer object
    this.captureDBO = gl.createRenderbuffer(); // MJ: depth buffer object

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.captureFBO);
  
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureCBO);

    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA16F, this.envSize, this.envSize);
    gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.captureCBO);

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureDBO);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.envSize, this.envSize);

    gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.captureDBO);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    this.envCubeMap = this.CreateCubeMap(this.envSize);

    this.rad2envProgram.Use();
    //MJ: 
    //=> public Use() {
    //   if (!this.glProgram) {
    //     console.error("Program.Use: program value not exist");
    //     return;
    //   }
  
    //   const gl = this.glSystem.context;
    //   gl.useProgram(this.glProgram);
    // }

    //MJ: "u_sphereMap" = equirectangularMap
    // this.shpereMap.texture is the texture bound to the pixel data
    this.rad2envProgram.SetTexture("u_sphereMap", this.shpereMap.texture, this.shpereMap.type);
    //MJ: =>

    // switch(sampler.type) {
    //   case TextureType.Texture2D: gl.bindTexture(gl.TEXTURE_2D, texture); break;
    //   case TextureType.TextureCubeMap: gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture); break;
    //   default: console.error("Invalid texture type."); break;
    // }

    gl.viewport(0, 0, this.envSize, this.envSize);

    //MJ: create a cubeMap for the spherical radiance
    this.RenderToCubeMap(this.envCubeMap, this.rad2envProgram); //MJ: this.envCubeMap is the target of the active texture


    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envCubeMap);

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);



    this.state = State.CalculateIrradianceMap;
  }//private RenderToEnvCubemap()

  private RenderToIrrCubemap() {
    const gl = this.glSystem.context;

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.captureFBO);

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureCBO);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA16F, this.irrSize, this.irrSize);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureDBO);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.irrSize, this.irrSize);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    this.irrCubeMap = this.CreateCubeMap(this.irrSize);

    this.env2irrProgram.Use();
    this.env2irrProgram.SetTexture("u_envMap", this.envCubeMap, TextureType.TextureCubeMap);

    gl.viewport(0, 0, this.irrSize, this.irrSize);

    //MJ: Create another cubeMap for irradiance map
    this.RenderToCubeMap(this.irrCubeMap, this.env2irrProgram);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    this.state = State.CalculatePreFilterMap;
  }

  private RenderToPreFilterMap() {
    const gl = this.glSystem.context;

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.captureFBO);

    this.filCubeMap = this.CreateCubeMap(this.filSize, true);

    this.env2filProgram.Use();
    this.env2filProgram.SetUniform("u_resolution", this.envSize, DataType.Float);
    this.env2filProgram.SetTexture("u_envMap", this.envCubeMap, TextureType.TextureCubeMap);

    const maxMipmapLevels = 5;
    for (let mipmap = 0; mipmap < maxMipmapLevels; ++mipmap) {
      const size = Math.round(this.filSize * Math.pow(0.5, mipmap));

      gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureCBO);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA16F, size, size);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureDBO);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, size, size);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);

      gl.viewport(0, 0, size, size);

      const roughness = mipmap / (maxMipmapLevels - 1.0);
      this.env2filProgram.SetUniform("u_roughness", roughness, DataType.Float);

      //MJ: create the third cubeMap for filCubeMap
      this.RenderToCubeMap(this.filCubeMap, this.env2filProgram, mipmap);
    }

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    this.state = State.GenerateBRDFLookUpMap;
  }

  private RenderToBDRFMap() {
    const gl = this.glSystem.context;

    // generate a 2d texture
    this.brdfLutMap = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.brdfLutMap);

    const level = 0;
    const internalFormat = gl.RG16F;
    const border = 0;
    const srcFormat = gl.RG;
    const srcType = gl.FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, this.lutSize, this.lutSize, border, srcFormat, srcType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.captureFBO);

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureCBO);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RG16F, this.lutSize, this.lutSize);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.captureDBO);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, this.lutSize, this.lutSize);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.brdfLutMap, 0);

    gl.viewport(0, 0, this.lutSize, this.lutSize);

    this.brdfGenProgram.Use();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const vertexInfo = this.unitQuad.vertex;
    gl.bindVertexArray(vertexInfo.vao);

    //MJ: Create the "BRDF map" (the second part of the specular product term)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexInfo.count);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    this.DeleteTempObjects();

    this.state = State.Finished;
  }

  private DeleteTempObjects() {
    const gl = this.glSystem.context;

    gl.deleteFramebuffer(this.captureFBO);
    gl.deleteRenderbuffer(this.captureCBO);
    gl.deleteRenderbuffer(this.captureDBO);

    this.captureFBO = null;
    this.captureCBO = null;
    this.captureDBO = null;

    gl.deleteTexture(this.shpereMap.texture);
    this.shpereMap = null;
  }

}