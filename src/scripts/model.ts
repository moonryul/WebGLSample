import { vec3 } from "gl-matrix";

export enum PrimitiveMode {
  TriangleList,
  TriangleStrip,
  TriangleFan
}

export enum DataType {
  Float,
  Float2,
  Float3,
  Float4,
  Float2x2,
  Float3x3,
  Float4x4,
  Int,
  UInt,
  Unknown
}

export enum DataUsage {
  position,
  normal,
  texCoord,
  color,
  index
}

export enum TextureType {
  Texture2D,
  TextureCubeMap
}

export interface DataLayout {
  type: DataType;
  usage: DataUsage;
}

export interface Data {
  data: number[];
  layouts: DataLayout[];
}

export interface Model {
  vertices: Data;
  indices?: Data;
  primitive: PrimitiveMode;

  // texture
  normalMap?: string;

  diffuseMap?: string;
  specularMap?: string;
  
  albedoMap?: string;
  metallicMap?: string;
  roughnessMap?: string;
  aoMap?: string;

  // material
  albedo?: vec3;
  metallic?: number;
  roughness?: number;
  ao?: number;
}

export function CreateSphere(): Model {
  const X_SEGMENTS = 64;
  const Y_SEGMENTS = 64;
  const PI = 3.14159265359;

  // const positions: number[] = [];
  // const texCoords: number[] = [];
  // const normals: number[] = [];
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= Y_SEGMENTS; ++y) {
    for (let x = 0; x <= X_SEGMENTS; ++x) {
      const xSegment = x / X_SEGMENTS;
      const ySegment = y / Y_SEGMENTS;
      const xPos = Math.cos(xSegment * 2.0 * PI) * Math.sin(ySegment * PI);
      const yPos = Math.cos(ySegment * PI);
      const zPos = Math.sin(xSegment * 2.0 * PI) * Math.sin(ySegment * PI);

      vertices.push(xPos, yPos, zPos);  // position
      vertices.push(xPos, yPos, zPos);  // normal
      vertices.push(xSegment, ySegment);// texCoord
      
    }
  }

  // TRIANGLE STRIP
  let oddRow = false;
  for (let y = 0; y < Y_SEGMENTS; ++y) {
    if (!oddRow) {
      // even rows: y == 0, y == 2; and so on
      for (let x = 0; x <= X_SEGMENTS; ++x) {
          indices.push(y       * (X_SEGMENTS + 1) + x);
          indices.push((y + 1) * (X_SEGMENTS + 1) + x);
      }
    } else {
      for (let x = X_SEGMENTS; x >= 0; --x) {
          indices.push((y + 1) * (X_SEGMENTS + 1) + x);
          indices.push(y       * (X_SEGMENTS + 1) + x);
      }
    }
    oddRow = !oddRow;
  }

  return {
    vertices: {
      layouts: [
        {
          type: DataType.Float3,
          usage: DataUsage.position
        }, {
          type: DataType.Float3,
          usage: DataUsage.normal
        }, {
          type: DataType.Float2,
          usage: DataUsage.texCoord
        }
      ],
      data: vertices
    },
    indices: {
      layouts: [
        {
          type: DataType.Int,
          usage: DataUsage.index
        }
      ],
      data: indices
    },
    primitive: PrimitiveMode.TriangleStrip,
  };
}

export function CreateSkybox(): Model {
  return {
    vertices: {
      layouts: [
        {
          type: DataType.Float3,
          usage: DataUsage.position
        }
      ],
      data: [ //MJ: skybox = [-1, 1]^3 with the center at (0,0,0)
        // Back face
        -1.0, -1.0, -1.0, //0
        -1.0,  1.0, -1.0, //1
         1.0,  1.0, -1.0,  //2
         1.0, -1.0, -1.0,  //3
        // Front face
        -1.0, -1.0,  1.0, //4
         1.0, -1.0,  1.0, //5
         1.0,  1.0,  1.0, //6
        -1.0,  1.0,  1.0, //7
        // Left face
        -1.0, -1.0, -1.0, //8
        -1.0, -1.0,  1.0, //9
        -1.0,  1.0,  1.0, //10
        -1.0,  1.0, -1.0, //11
        // Right face
         1.0, -1.0, -1.0, //12
         1.0,  1.0, -1.0, //13
         1.0,  1.0,  1.0, //14
         1.0, -1.0,  1.0, //15
        // Bottom face
        -1.0, -1.0, -1.0, //16
         1.0, -1.0, -1.0, //17
         1.0, -1.0,  1.0, //18
        -1.0, -1.0,  1.0, //19
        // Top face
        -1.0,  1.0, -1.0, //20
        -1.0,  1.0,  1.0, //21
         1.0,  1.0,  1.0, //22
         1.0,  1.0, -1.0, //23
      ]
    },
    indices: {
      layouts: [
        {
          type: DataType.Int,
          usage: DataUsage.index
        }
      ],
      data: [
        0,  2,  3,    2,  0,  1,    // back
        4,  5,  6,    6,  7,  4,    // front
        10, 11, 8,    8,  9, 10,    // left
        14, 12, 13,   12, 14, 15,   // right
        16, 17, 18,   18, 19, 16,   // bottom
        20, 22, 23,   22, 20, 21,   // top
      ]
    },
    primitive: PrimitiveMode.TriangleList
  };
}

export function CreateCube(): Model {
  return {
    vertices: {
      layouts: [
        {
          type: DataType.Float3,
          usage: DataUsage.position
        }, {
          type: DataType.Float2,
          usage: DataUsage.texCoord
        }
      ],
      data: [
        // position        texCoord
        // Front face 
        -1.0, -1.0,  1.0,  0.0,  0.0,
         1.0, -1.0,  1.0,  1.0,  0.0,
         1.0,  1.0,  1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,  0.0,  1.0,
        // Back face
        -1.0, -1.0, -1.0,  0.0,  0.0,
        -1.0,  1.0, -1.0,  1.0,  0.0,
         1.0,  1.0, -1.0,  1.0,  1.0,
         1.0, -1.0, -1.0,  0.0,  1.0,
        // Top face
        -1.0,  1.0, -1.0,  0.0,  0.0,
        -1.0,  1.0,  1.0,  1.0,  0.0,
         1.0,  1.0,  1.0,  1.0,  1.0,
         1.0,  1.0, -1.0,  0.0,  1.0,
        // Bottom face
        -1.0, -1.0, -1.0,  0.0,  0.0,
         1.0, -1.0, -1.0,  1.0,  0.0,
         1.0, -1.0,  1.0,  1.0,  1.0,
        -1.0, -1.0,  1.0,  0.0,  1.0,
        // Right face
         1.0, -1.0, -1.0,  0.0,  0.0,
         1.0,  1.0, -1.0,  1.0,  0.0,
         1.0,  1.0,  1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,  0.0,  1.0,
        // Left face
        -1.0, -1.0, -1.0,  0.0,  0.0,
        -1.0, -1.0,  1.0,  1.0,  0.0,
        -1.0,  1.0,  1.0,  1.0,  1.0,
        -1.0,  1.0, -1.0,  0.0,  1.0,
      ]
    },
    indices: {
      layouts: [
        {
          type: DataType.Int,
          usage: DataUsage.index
        }
      ],
      data: [
        0,  1,  2,      0,  2,  3,    // front: consits of two triangles, one = 0,  1,  2; the other = 0,  2,  3;
                                      // 0,1,2 are indices to the vertex in the mesh
        4,  5,  6,      4,  6,  7,    // back
        8,  9,  10,     8,  10, 11,   // top
        12, 13, 14,     12, 14, 15,   // bottom
        16, 17, 18,     16, 18, 19,   // right
        20, 21, 22,     20, 22, 23,   // left
      ]
    },
    primitive: PrimitiveMode.TriangleList
  };

}

export function CreateQuad(): Model {
  return {
    vertices: {
      layouts: [
        {
          type: DataType.Float3,
          usage: DataUsage.position
        }, {
          type: DataType.Float2,
          usage: DataUsage.texCoord
        }
      ],
      data: [
        -1.0,  1.0,  0.0,  0.0,  1.0,
        -1.0, -1.0,  0.0,  0.0,  0.0,
         1.0,  1.0,  0.0,  1.0,  1.0,
         1.0, -1.0,  0.0,  1.0,  0.0,
      ]
    },
    primitive: PrimitiveMode.TriangleStrip
  };
}
