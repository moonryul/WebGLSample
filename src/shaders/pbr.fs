precision mediump float;

// material
#ifdef HAS_PBR_TEXTURES
uniform sampler2D u_normalMap;
uniform sampler2D u_albedoMap;
uniform sampler2D u_metallicMap;
uniform sampler2D u_roughnessMap;
uniform sampler2D u_aoMap;
#else
uniform vec3 u_albedo;
uniform float u_metallic;
uniform float u_roughness;
uniform float u_ao;
#endif

// IBL
uniform samplerCube u_irradianceMap;
uniform samplerCube u_prefilterMap;
uniform sampler2D u_brdfMap;

// light
uniform vec3 u_lightPos;
uniform vec3 u_lightColor;

uniform vec3 u_viewPos;

in vec3 v_position;
in vec3 v_normal;
in vec2 v_texCoord;

out vec4 o_fragColor;

const float PI = 3.14159265359;
const float MAX_REFLECTION_LOD = 4.0;

#ifdef HAS_PBR_TEXTURES
// Easy trick to get tangent-normals to world-space to keep PBR code simplified.
vec3 NormalFromTexture() {
  vec3 tangentNormal = texture(u_normalMap, v_texCoord).xyz * 2.0 - 1.0;

  vec3 Q1 = dFdx(v_position);
  vec3 Q2 = dFdy(v_position);
  vec2 st1 = dFdx(v_texCoord);
  vec2 st2 = dFdy(v_texCoord);

  vec3 N = normalize(v_normal);
  vec3 T = normalize(Q1 * st2.t - Q2 * st1.t);
  vec3 B = -normalize(cross(N, T));
  mat3 TBN = mat3(T, B, N);

  return normalize(TBN * tangentNormal);
}
#endif

vec3 HDRToneMapping(vec3 color) {
  return color / (color + vec3(1.0));
}

vec3 GammaCorrect(vec3 color) {
  return pow(color, vec3(1.0 / 2.2));
}

// D, G, F formula is refered from http://graphicrants.blogspot.tw/2013/08/specular-brdf-reference.html

// GGX Trowbridge-Reitz
float DistributionGGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  denom = PI * denom * denom;

  return nom / denom;
}

// Smith's Schlick-GGX with k = (a + 1)2 / 8
float GeometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;

  float nom = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return nom / denom;
}

float GeometrySmith(float NdotV, float NdotL, float roughness) {
  float ggx1 = GeometrySchlickGGX(NdotV, roughness);
  float ggx2 = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

// Fresnel-Schlick
vec3 FresnelSchlick(float cosTheta, vec3 f0) {
  return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

vec3 FresnelSchlickRoughness(float cosTheta, vec3 f0, float roughness) {
  return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(1.0 - cosTheta, 5.0);
}

void main(void) {
#ifdef HAS_PBR_TEXTURES
  vec3 albedo = pow(texture(u_albedoMap, v_texCoord).rgb, vec3(2.2));
  float metallic = texture(u_metallicMap, v_texCoord).r;
  float roughness = texture(u_roughnessMap, v_texCoord).r;
  float ao = texture(u_aoMap, v_texCoord).r;

  vec3 N = NormalFromTexture();
#else
  vec3 albedo = u_albedo;
  float metallic = u_metallic;
  float roughness = u_roughness;
  float ao = u_ao;

  vec3 N = normalize(v_normal);
#endif
  vec3 V = normalize(u_viewPos - v_position);
  vec3 R = reflect(-V, N);

  vec3 L = normalize(u_lightPos - v_position);
  vec3 H = normalize(V + L);

  float NdotH = max(dot(N, H), 0.0);
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);

  // Calculate reflectance at normal incidence; 
  // If dia-electric (like plastic) use F0 of 0.04
  // And if it's a metal, use the albedo color as F0 (metal workflow)
  vec3 f0 = vec3(0.04);
  f0 = mix(f0, albedo, metallic);

  // calculate light
  vec3 Lo = vec3(0.0);
  {
    // calculate light radiance
    float distance = length(u_lightPos - v_position);
    float attenuation = 1.0 / (distance * distance);
    vec3 radiance = u_lightColor * attenuation;

    // BRDF of Cook-Torrance
    float D = DistributionGGX(NdotH, roughness);
    float G = GeometrySmith(NdotV, NdotL, roughness);
    vec3 F = FresnelSchlick(max(dot(H, V), 0.0), f0);

    vec3 nom = D * G * F;
    float denom = 4.0 * NdotV * NdotL + 0.001;
    vec3 specular = nom / denom;

    // kS is equal to Fresnel
    vec3 kS = F;
    // For energy conservation, the diffuse and specular light can't be above 1.0; 
    // To preserve this relationship the diffuse component (kD) should equal 1.0 - kS.
    vec3 kD = vec3(1.0) - kS;
    // Multiply kD by the inverse metalness such that only non-metals have diffuse lighting.
    kD *= 1.0 - metallic;

    // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
    Lo += (kD * albedo / PI + specular) * radiance * NdotL;
  }

  // calculate ambient
  vec3 F = FresnelSchlickRoughness(NdotV, f0, roughness);

  // diffuse
  vec3 kS = F;
  vec3 kD = vec3(1.0) - kS;
  kD *= 1.0 - metallic;
  vec3 irradiance = texture(u_irradianceMap, N).rgb;
  vec3 diffuse = irradiance * albedo;

  // specular
  vec3 perfilteredColor = textureLod(u_prefilterMap, R, roughness * MAX_REFLECTION_LOD).rgb;
  vec2 brdf = texture(u_brdfMap, vec2(NdotV, roughness)).rg;
  vec3 specular = perfilteredColor * (F * brdf.x + brdf.y);

  vec3 ambient = (kD * diffuse + specular) * ao;

  // sum components value
  vec3 color = ambient + Lo;
  
  color = HDRToneMapping(color);
  color = GammaCorrect(color);
  o_fragColor = vec4(color, 1.0);
}