#version 300 es
precision highp float;
in vec2 _webcl_position;
out vec2 _webcl_pos;
in vec2 _webcl_texture;

void main(void) {
  _webcl_pos = _webcl_texture;
  gl_Position = vec4(_webcl_position.xy, 0.0, 1.0);
}