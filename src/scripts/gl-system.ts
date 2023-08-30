import * as $ from "jquery";
import * as _ from "lodash";
import { HDRImage } from "./hdrpng";
import { vec3 } from "gl-matrix";
import { DataType, TextureType, DataLayout, Data } from "./model";

export interface LightInfo {
  position?: vec3;
  color?: vec3;
}

export interface TextureInfo {
  texture: WebGLTexture;
  type: TextureType;
  width: number;
  height: number;
}

export interface VertexInfo {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer; // vertex buffer
  ebo?: WebGLBuffer; // element buffer
  // Count is element count if ebo is exist
  // Count is vertex count if ebo is not exist
  count: number;
  layouts: DataLayout[];
}

// return value is power of two
export function IsPOT(value: number): boolean {
  return (value & (value - 1)) == 0;
}

const DependentedExts = [
  "EXT_color_buffer_float",
  "OES_texture_float_linear"
];

const ShaderVersion = `#version 300 es \n`;

export class GLSystem {

  private extensions: {[id: string]: any} = {};

  private _isReliable: boolean = true;
  public get isReliable(): boolean { return this._isReliable; }

  public constructor(private gl: WebGL2RenderingContext) {
    _.map(DependentedExts, (ext) => {
      !this.GetExtension(ext) && (this._isReliable = false);
    });
  }

  public get context(): WebGL2RenderingContext {
    return this.gl;
  }

  public GetExtension(ext: string): any {
    let extObj = this.extensions[ext];
    if (!extObj) {
      extObj = this.gl.getExtension(ext);
      (extObj !== null) ? (this.extensions[ext] = extObj) : alert("Extension " + ext + " is not supported!");
    }
    return extObj;
  }

  // Initialize a texture and load an image.
  // When the image finished loading copy it into the texture.
  public CreateTexture(url: string): TextureInfo {
    if (!url) {
      return null;
    }

    const gl = this.gl;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGB;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGB;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([255, 0, 255]);  // deep pink
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType, pixel);

    gl.bindTexture(gl.TEXTURE_2D, null);

    const textureInfo: TextureInfo = {
      texture,
      type: TextureType.Texture2D,
      width,
      height,
    };

    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, image);

      // WebGL1 has different requirements for power of 2 images
      // vs non power of 2 images so check if the image is a
      // power of 2 in both dimensions.
      if (IsPOT(image.width) && IsPOT(image.height)) {
        // Yes, it's a power of 2. Generate mips.
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        // No, it's not a power of 2. Turn of mips and set
        // wrapping to clamp to edge
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }

      gl.bindTexture(gl.TEXTURE_2D, null);

      textureInfo.width = image.width;
      textureInfo.height = image.height;
    };
    image.src = url;

    return textureInfo;
  }//public CreateTexture

  //MJ: CreateHDRTExture() is invoked by
  // preCompute.image = "assets/Mans_Outside_2k.hdr"; //MJ: Equi-rectangular map for the radiance map
  
  public CreateHDRTexture(url: string): TextureInfo {
    if (!url) {
      return null;
    }

    const gl = this.gl;

    const texture = gl.createTexture();

    const level = 0;
    const internalFormat = gl.RGB16F;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGB;
    const srcType = gl.FLOAT;

    const textureInfo: TextureInfo = {
      texture: null,
      type: TextureType.Texture2D,
      width,
      height,
    };
    const hdrImage = new HDRImage();


    //MJ: hdrImage.onload = () => { } => 
    //public set onload(func: () => void) {
    //if (this.res) {
    // this.res.onload = func;
    // }
     // }

     //MJ: this.res (which appears to be a canvas element) exists, its onload event is set to the function you provided.

     //MJ: set  a handler for the onload event of the HDRImage class. 
    hdrImage.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, hdrImage.width, hdrImage.height, 
                    border, srcFormat, srcType, hdrImage.DataFloat(true));

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.bindTexture(gl.TEXTURE_2D, null);
      
      textureInfo.texture = texture;
      textureInfo.width = hdrImage.width;
      textureInfo.height = hdrImage.height;
    };

    hdrImage.src = url;

    return textureInfo;
  }//public CreateHDRTexture

  private LoadShader(source: string, type: number): WebGLShader {
    const gl = this.gl;

    const shader = gl.createShader(type);
    // Send the source to the shader object
    gl.shaderSource(shader, source);
    // Compile the shader program
    gl.compileShader(shader);

    // check if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }//private LoadShader

  public CreateProgram(vsSource: string, fsSource: string, macros: string[]): WebGLProgram {
    const gl = this.gl;

    let preprocessor = "";
    if (macros.length > 0) {
      _.map(macros, (macro: string) => {
        preprocessor += `${macro} \n`;
      });
    }

    const prefix = ShaderVersion + preprocessor;

    const vertexShader = this.LoadShader(prefix + vsSource, gl.VERTEX_SHADER);
    const fragmentShader = this.LoadShader(prefix + fsSource, gl.FRAGMENT_SHADER);
  
    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
  
    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  }//public CreateProgram

  public CreateProgramFromFile(vsFile: string, fsFile: string, macros: string[], complete: (program: WebGLProgram) => void): void {
    const vertDeferred = $.ajax({
      url: vsFile,
      dataType: 'text',
      async: true,
      error: (jqXhr, textStatus, errorThrown) => {
        console.error("Read " + vsFile + " failed! File not exist");
      }
    });
    const fragDeferred = $.ajax({
      url: fsFile,
      dataType: 'text',
      async: true,
      error: (jqXhr, textStatus, errorThrown) => {
        console.error("Read " + fsFile + " failed! File not exist");
      }
    });
    $.when(vertDeferred, fragDeferred).then((vsSource, fsSource) => {
      const program = this.CreateProgram(vsSource[0], fsSource[0], macros);
      complete && complete(program);
    });
  }//   public CreateProgramFromFile

  public CreateBufferObject(data: number[], type: DataType, isElement: boolean = false): WebGLBuffer {
    if (!data) {
      return null;
    }

    const gl = this.gl;

    // Create a buffer object.
    const buffer = gl.createBuffer();

    const target = (isElement === true ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER);

    // Select the buffer object as the one to apply data
    gl.bindBuffer(target, buffer);
    switch(type) {
      case DataType.Float:
      case DataType.Float2:
      case DataType.Float3:
      case DataType.Float4:
        gl.bufferData(target, new Float32Array(data), gl.STATIC_DRAW);
        break;
      case DataType.Int:
        gl.bufferData(target, new Uint16Array(data), gl.STATIC_DRAW);
        break;
      default:
        console.error("CreateBufferObject: invalid buffer type " + type);
        break;
    }

    gl.bindBuffer(target, null);

    return buffer;
  }//  public CreateBufferObject

  public CreateVertexInfo(vertices: Data, indices: Data | null): VertexInfo {
    if (!vertices || !vertices.data) {
      return null;
    }

    const gl = this.gl;

    const vbo = this.CreateBufferObject(vertices.data, DataType.Float, false);
    //MJ: You can think of a VBO as an array in GPU memory where you store vertex-related data.
    const ebo = (indices ? this.CreateBufferObject(indices.data, DataType.Int, true): null);
    const vao = gl.createVertexArray();
    //MJ: A VAO is an object that encapsulates the setup of all the vertex data. It essentially saves 
    // the "state" of all the vertex attribute pointers, buffer bindings, and other related data.
    //, a VBO directly holds the data (like vertex positions or colors), 
    //while a VAO saves the configuration or state of how that data will be used in rendering.

    // setup vertex array
    gl.bindVertexArray(vao);
    //MJ => // Generate a VAO
      //        glGenVertexArrays(1, &vertexArrayID);
      //        glBindVertexArray(vertexArrayID);  
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

//MJ: A VAO references one or more VBOs. When a VAO is bound, OpenGL uses the VBOs associated with it.
//When setting up vertex attributes in OpenGL, you'll often deal with different kinds of vertex data:

// Vertex positions
// Texture coordinates (UVs)
// Normals
// Tangents
// Vertex colors
// And potentially more, depending on your application's needs
// Each of these can be stored in a separate VBO. When you set up a VAO, 
// you're effectively binding one or more VBOs
//  and then specifying how the data in those VBOs should be interpreted

//MJ: Aha. But when you use a single buffer to store position, tex coords, normal map, then you need to specify the offset explicitly?
//When using a single buffer to store multiple types of vertex attributes (like positions, texture coordinates, and normals) in an interleaved fashion, the offset and stride become essential for informing OpenGL how to interpret the buffer's data correctly.

// To illustrate, let's assume the buffer's data is laid out as follows for each vertex:
// Position TexCoord Normal Position TexCoord Normal ...

// Here's how you would set up the vertex attribute pointers with interleaved data:

// // Assuming these sizes for each attribute
// GLsizei posSize = 3 * sizeof(float);
// GLsizei texCoordSize = 2 * sizeof(float);
// GLsizei normalSize = 3 * sizeof(float);

// // Stride is the total size of all attributes combined for a single vertex
// GLsizei stride = posSize + texCoordSize + normalSize;

// // Bind the VAO
// glBindVertexArray(vertexArrayID);

// // Bind the interleaved buffer
// glBindBuffer(GL_ARRAY_BUFFER, interleavedBufferID);

// // Set the position attribute pointer
// glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, (void*)0);
// glEnableVertexAttribArray(0);

// // Set the texture coordinate attribute pointer. Note the offset!
// glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, stride, (void*)(posSize));
// glEnableVertexAttribArray(1);

// // Set the normal attribute pointer. Note the offset!
// glVertexAttribPointer(2, 3, GL_FLOAT, GL_FALSE, stride, (void*)(posSize + texCoordSize));
// glEnableVertexAttribArray(2);

    const sizeOfFloat = 4;
    // calculate stride

    //MJ:

  //   vertices: {
  //     layouts: [ // layouts represents how vertex attributes, position, normal, texCoord, are arranged.
  //       {
  //         type: DataType.Float3,
  //         usage: DataUsage.position
  //       }, {
  //         type: DataType.Float3,
  //         usage: DataUsage.normal
  //       }, {
  //         type: DataType.Float2,
  //         usage: DataUsage.texCoord
  //       }
  //     ],
  //     data: vertices
  //   },
  //   indices: {
  //     layouts: [
  //       {
  //         type: DataType.Int,
  //         usage: DataUsage.index
  //       }
  //     ],
  //     data: indices
  //   },
  //   primitive: PrimitiveMode.TriangleStrip,
  // };


    let stride = 0;

    //MJ: find the stride of a single vertex by using the layouts of each attribute of the vertex 
    //MJ: vertices.layouts => All the vertices of a mesh has the same layouts.
    for (let i = 0; i < vertices.layouts.length; ++i) { //MJ:  vertices.layouts.length = 3 = list of three elements
      const layout = vertices.layouts[i];

      switch(layout.type) {
        case DataType.Float: stride += sizeOfFloat; break;
        case DataType.Float2: stride += 2 * sizeOfFloat; break;
        case DataType.Float3: stride += 3 * sizeOfFloat; break;
        case DataType.Float4: stride += 4 * sizeOfFloat; break;
        default: console.error("Invalod layout data type in vertices, type:" + layout.type);
      }

    }

     //MJ:
      // "stride" refers to the number of bytes between the beginning of one vertex 
      // and the beginning of the next vertex in a buffer of vertex data.
      //MJ: To illustrate with a simple example:

      // Imagine a vertex has a 3D position (3 floats) and a color (4 floats).
      // Each float is 4 bytes.
      // Thus, the stride would be (3 + 4) * 4 = 28 bytes.


    let offset = 0;

    for (let i = 0; i < vertices.layouts.length; ++i) {
      //MJ: i refer to each attribute of the vertex
      const layout = vertices.layouts[i];
      gl.enableVertexAttribArray(layout.usage);
      //MJ
      // Each of these attributes can be thought of as a "channel" of data that you're passing to the GPU.
      //  Before you use or reference these channels in your shaders, you need to enable them.
      //  That's what gl.enableVertexAttribArray(...); does.

      //  By enabling an attribute array using its index, you're essentially telling the GPU:
      //   "Hey, I'm going to be passing data for this attribute, so please be prepared to use it."
      let size = 0;

      switch(layout.type) {
        case DataType.Float: size = 1; break;
        case DataType.Float2: size = 2; break;
        case DataType.Float3: size = 3; break;
        case DataType.Float4: size = 4; break;
        default: console.error("Invalod layout data type in vertices, type:" + layout.type);
      }

      gl.vertexAttribPointer(layout.usage, size, gl.FLOAT, false, stride, offset);
      //MJ: layout.usage =0 for position attribute, 1 for texture coordinates, 2 for normal maps

// MJ: offset:  The offset tells the GPU, "Start reading this particular attribute this many bytes into the buffer."

// Let's break this down with a simple example:

// Imagine you have a buffer that stores data for each vertex in the following format: [position, color, texture coordinates].

// Each position is 3 floats (3D coordinates).
// Each color is 4 floats (RGBA values).
// Each texture coordinate is 2 floats (u, v).
// If you were setting the attribute pointer for:

// Position: The offset would be 0. Because positions start right at the beginning of each vertex's data.
// Color: The offset would be the size of the position data. Since positions are 3 floats, and each float is 4 bytes,
//  the offset for color would be 3 * 4 = 12 bytes.
// Texture Coordinates: The offset would be the size of the position and color data combined. 
// This would be (3 + 4) * 4 = 28 bytes.
// In the provided code, the offset is incremented in the loop over vertices.layouts to account 
// for the total size of all previous attrib
     

      offset += size * sizeOfFloat;
    } //  for (let i = 0; i < vertices.layouts.length; ++i) 

    if (ebo) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    }

    gl.bindVertexArray(null);

    const count = (ebo !== null ? indices.data.length : vertices.data.length / (stride / sizeOfFloat));
    const layouts = vertices.layouts;

    return {vao, vbo, ebo, count, layouts };
  }//public CreateVertexInfo


  public CheckBindedFramebufferStatus(): boolean {
    const gl = this.gl;

    let isSuccess = false;
    const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    switch (fbStatus) {
      case gl.FRAMEBUFFER_COMPLETE: console.log("Frame Buffer Status: FRAMEBUFFER_COMPLETE"); isSuccess = true; break;
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT: console.error("Frame Buffer Status: FRAMEBUFFER_INCOMPLETE_ATTACHMENT"); break;
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: console.error("Frame Buffer Status: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT"); break;
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS: console.error("Frame Buffer Status: FRAMEBUFFER_INCOMPLETE_DIMENSIONS"); break;
      case gl.FRAMEBUFFER_UNSUPPORTED: console.error("Frame Buffer Status: FRAMEBUFFER_UNSUPPORTED"); break;
      case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: console.error("Frame Buffer Status: FRAMEBUFFER_INCOMPLETE_MULTISAMPLE"); break;
      default: console.error("Frame Buffer Status:" + fbStatus); break;
    }

    return isSuccess;
  }//public CheckBindedFramebufferStatus()

  public CheckError(): boolean {
    const gl = this.gl;

    let isNoError = false;
    const error = gl.getError();
    switch (error) {
      case gl.NO_ERROR: console.log("WebGL Error: NO_ERROR"); isNoError = true; break;
      case gl.INVALID_ENUM: console.error("WebGL Error: INVALID_ENUM"); break;
      case gl.INVALID_VALUE: console.error("WebGL Error: INVALID_VALUE"); break;
      case gl.INVALID_OPERATION: console.error("WebGL Error: INVALID_OPERATION"); break;
      case gl.INVALID_FRAMEBUFFER_OPERATION: console.error("WebGL Error: INVALID_FRAMEBUFFER_OPERATION"); break;
      case gl.OUT_OF_MEMORY: console.error("WebGL Error: OUT_OF_MEMORY"); break;
      case gl.CONTEXT_LOST_WEBGL: console.error("WebGL Error: CONTEXT_LOST_WEBGL"); break;
      default: console.error("WebGL Error:" + error); break;
    }

    return isNoError;
  }

}