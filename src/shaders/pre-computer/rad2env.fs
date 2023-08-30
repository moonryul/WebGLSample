precision mediump float;


//MJ: For the fragment shader, we color each part of the cube 
// as if we neatly folded the equirectangular map onto each side of the cube.
//  To accomplish this, we take the fragment's sample direction 
//  as interpolated from the cube's local position and 
//  then use this direction vector and some trigonometry magic (spherical to cartesian)
//   to sample the equirectangular map as if it's a cubemap itself. 
//   We directly store the result onto the cube-face's fragment which should be all we need to do:

// radiance spherical map to environment cube map

uniform sampler2D u_sphereMap;
//MJ: It was uniform sampler2D equirectangularMap in https://learnopengl.com/PBR/IBL/Diffuse-irradiance
// But the name of the sampler is not important.


in vec3 v_position;

out vec4 o_fragColor;

const vec2 invAtan = vec2(0.1591, 0.3183);

//MJ: UV mapping, taking the xyz-coordinates on a sphere and mapping it into a uv-coordinate on the texture. 
vec2 SampleSphereMap(vec3 v) {
  vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
  uv *= invAtan;
  uv += 0.5;
  return uv;
}




void main(void) {
  vec2 uv = SampleSphereMap(normalize(v_position));
  vec3 color = texture(u_sphereMap, uv).rgb;
  o_fragColor = vec4(color, 1.0);
}
