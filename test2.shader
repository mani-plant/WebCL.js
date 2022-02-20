#version 300 es
#define _webcl_texIndex(n,i) floor(i/4.)
		#define _webcl_colorIndex(n,i) mod(i,4.)
		#define _webcl_texPos(n,i) vec2(mod(_webcl_texIndex(n,i),_webcl_sizeI[n]), floor(_webcl_texIndex(n,i)/_webcl_sizeI[n]))
		#define _webcl_texCoord(n,i) (_webcl_texPos(n,i)+0.5)/_webcl_sizeI[n]
		#define _webcl_readID(n,i) texture(_webcl_uTexture[n], _webcl_texCoord(n,i))
		precision highp float;
		float _webcl_sizeO = 3.;
		uniform sampler2D _webcl_uTexture[2];
        float _webcl_size[2] = float[](3.,3.);
        float _webcl_getTex0(vec2 coord) {
            return texture(_webcl_uTexture[0], coord).r;
        }
        float _webcl_getTex1(vec2 coord) {
            return texture(_webcl_uTexture[1], coord).r;
        }
        #define _webcl_getTexture(i, coord) texture(_webcl_uTexture[i], coord)
		in vec2 _webcl_pos;
        vec2 _webcl_indXY = _webcl_pos*sizeO - 0.5;
        float _webcl_curIndex = (_webcl_indXY.y*sizeO + _webcl_indXY.x)*4.;
        #define _webcl_getIndex() _webcl_curIndex + __webcl_i;

		layout(location = 0) out float _webcl_out0;

		
		vec2 _webcl_getPos(int i, vec2 ind){
   			return (ind + 0.5)/size[i];
   		}

		vec2 _webcl_getInd(int i, float index){
   			float y = float(int(index)/int(size[i]));
   			float x = index - size[i]*y;
   			return vec2(x,y);
   		}

   		float _webcl_readI0(float index){
            return _webcl_getTex0(_webcl_getPos(0, _webcl_getInd(0, index)));
        }
        float _webcl_readI1(float index){
            return _webcl_getTex1(_webcl_getPos(1, _webcl_getInd(1, index)));
        }

		
		vec2 _webcl_indXY(){
   			return pos*sizeO - 0.5 ;
   		}

   		float _webcl_getIndex(){
   			vec2 ind = indXY();
   			return (ind.y*sizeO + ind.x);
   		}

   		void _webcl_commit(float op[1]){
   			_webcl_out0 = op[0];

   		}