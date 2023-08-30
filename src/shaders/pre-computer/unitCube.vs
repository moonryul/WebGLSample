uniform mat4 u_viewProjMatrix;

layout (location = 0) in vec3 a_position;

out vec3 v_position;

void main(void) {
  v_position = a_position;
  gl_Position = u_viewProjMatrix * vec4(a_position, 1.0);
}

//MJ: location = 0 means that the position attribute of the vertex is located at the 0th slot of the vertex buffer?
//Yes, that's essentially correct. When you use layout (location = 0) in vec3 a_position; in your shader code,
 //you're explicitly specifying that the attribute a_position is to be found in the 0th slot (or location)
 // of the vertex attribute list.

//In the context of OpenGL, when you later bind a Vertex Buffer Object (VBO) and set up vertex attribute pointers
// using glVertexAttribPointer, the first argument you provide is this location. So if you've said location = 0 
// in your shader for a_position, when setting up your vertex attributes in the OpenGL API, you would use:

//glVertexAttribPointer(0, ...);  // 0 here corresponds to the location in the shader

//MJ: 
//Typically, a_position starts off as coordinates in the object's local space. This is the space in which the model's vertices are originally defined. Often, when you obtain a 3D model from a modeling tool or software, the vertex positions are specified
// relative to the model's origin, not the world's origin. This is the local or model space. 
 
// When you want to place and orient the object within a larger scene (the world), you use a model matrix to transform these local coordinates into world coordinates. This is commonly done in the vertex shader.

//For example:
//vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
//Where u_modelMatrix is the transformation matrix that places the object in the world.

// Because the vertex shader does not use u_modelMatrix, it is assumed that the center of the mesh is at the world origin.
