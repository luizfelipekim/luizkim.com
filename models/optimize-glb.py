#!/usr/bin/env python3
"""Build step for the claw cabinet, run by hand after exporting from Blender:

    python3 models/optimize-glb.py models/claw-cabinet-export.glb   (the raw Blender export; kept out of git)

Reads the Blender export and writes two files the site loads with the vendored r128 GLTFLoader:
  models/claw-cabinet.glb        the neutral cabinet only (what every visitor downloads)
  models/claw-cabinet-deco.glb   the deco_* ornament nodes, fetched only when a look asks for one
Both are quantized (KHR_mesh_quantization: int16 positions, int8 normals, uint16 UVs, no decoder needed)
and their baked ambient-occlusion JPEGs are downscaled (the cabinet is at most ~700 px wide on screen).
Needs numpy and Pillow (both in the stock Anaconda python)."""
import sys, json, struct, io, os
import numpy as np
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'models/claw-cabinet-export.glb'
out_dir = os.path.dirname(src) or '.'
AO_SIZE = {'cabinet': 1024, 'deco': 512}   # longest side of each file's occlusion map
AO_QUALITY = 82

def read_glb(path):
    b = open(path, 'rb').read()
    off, chunks = 12, []
    while off < len(b):
        cl, ct = struct.unpack('<II', b[off:off + 8]); chunks.append((ct, b[off + 8:off + 8 + cl])); off += 8 + cl
    return json.loads(chunks[0][1]), chunks[1][1]

def accessor(js, bin_, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'VEC3': 3, 'VEC2': 2, 'SCALAR': 1}[a['type']]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]
    return np.frombuffer(bin_, dtype=dt, count=a['count'] * n, offset=o).reshape(-1, n)

class Builder:
    def __init__(self):
        self.bin = bytearray(); self.views = []; self.accessors = []
    def pad(self):
        while len(self.bin) % 4: self.bin += b'\0'
    def view(self, data, stride=None, target=None):
        self.pad(); self.views.append({'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)})
        if stride: self.views[-1]['byteStride'] = stride
        if target: self.views[-1]['target'] = target
        self.bin += data; return len(self.views) - 1
    def acc(self, view, ctype, atype, count, normalized=False, mn=None, mx=None):
        a = {'bufferView': view, 'componentType': ctype, 'type': atype, 'count': count}
        if normalized: a['normalized'] = True
        if mn is not None: a['min'] = mn; a['max'] = mx
        self.accessors.append(a); return len(self.accessors) - 1

def quantize_mesh(js, bin_, mesh, b):
    """Returns (new mesh dict, node translation, node scale): one uniform grid for all primitives of the mesh."""
    prims = mesh['primitives']
    pos_all = np.concatenate([accessor(js, bin_, p['attributes']['POSITION']) for p in prims])
    lo, hi = pos_all.min(0), pos_all.max(0); center = (lo + hi) / 2
    s = float((hi - lo).max() / 2 / 32767) or 1e-6
    new_prims = []
    for p in prims:
        pos = accessor(js, bin_, p['attributes']['POSITION']); nrm = accessor(js, bin_, p['attributes']['NORMAL']); uv = accessor(js, bin_, p['attributes']['TEXCOORD_0'])
        q = np.rint((pos - center) / s).astype(np.int16)
        qpad = np.zeros((len(q), 4), np.int16); qpad[:, :3] = q                       # 8-byte stride keeps elements 4-byte aligned
        n8 = np.zeros((len(nrm), 4), np.int8); n8[:, :3] = np.clip(np.rint(nrm * 127), -127, 127).astype(np.int8)
        uv16 = np.clip(np.rint(uv * 65535), 0, 65535).astype(np.uint16)
        idx = accessor(js, bin_, p['indices']).astype(np.uint16)
        a = {'POSITION': b.acc(b.view(qpad.tobytes(), stride=8, target=34962), 5122, 'VEC3', len(q), mn=[int(v) for v in q.min(0)], mx=[int(v) for v in q.max(0)]),
             'NORMAL': b.acc(b.view(n8.tobytes(), stride=4, target=34962), 5120, 'VEC3', len(q), normalized=True),
             'TEXCOORD_0': b.acc(b.view(uv16.tobytes(), target=34962), 5123, 'VEC2', len(q), normalized=True)}
        new_prims.append({'attributes': a, 'indices': b.acc(b.view(idx.tobytes(), target=34963), 5123, 'SCALAR', len(idx)), 'material': p['material']})
    return {'name': mesh.get('name'), 'primitives': new_prims}, [float(v) for v in center], [s, s, s]

def shrink_image(data, size):
    im = Image.open(io.BytesIO(data)).convert('L')           # the maps are grey; one channel compresses better
    if max(im.size) > size: im = im.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=AO_QUALITY, optimize=True, progressive=False); return buf.getvalue(), im.size

def write_glb(path, js, bin_):
    bin_ = bytes(bin_) + b'\0' * (-len(bin_) % 4)
    jsb = json.dumps(js, separators=(',', ':')).encode(); jsb += b' ' * (-len(jsb) % 4)
    body = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jsb) + 8 + len(bin_)) + struct.pack('<II', len(jsb), 0x4E4F534A) + jsb + struct.pack('<II', len(bin_), 0x004E4942) + bin_
    open(path, 'wb').write(body); return len(body)

def build(js, bin_, node_names, kind):
    b = Builder(); out = {'asset': {'version': '2.0', 'generator': 'optimize-glb.py (from ' + js['asset'].get('generator', '?') + ')'},
                          'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
                          'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'materials': [], 'textures': [], 'images': [], 'samplers': js.get('samplers', [{}]), 'bufferViews': b.views, 'accessors': b.accessors}
    mat_map, tex_map, img_map = {}, {}, {}
    def image(i):
        if i not in img_map:
            im = js['images'][i]; bv = js['bufferViews'][im['bufferView']]
            data, size = shrink_image(bin_[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']], AO_SIZE[kind])
            out['images'].append({'name': im.get('name', ''), 'mimeType': 'image/jpeg', 'bufferView': b.view(data)}); img_map[i] = len(out['images']) - 1
            print(f"  {kind}: image {im.get('name','')} -> {size[0]}x{size[1]} JPEG {len(data)//1024} KB")
        return img_map[i]
    def texture(i):
        if i not in tex_map:
            t = dict(js['textures'][i]); t['source'] = image(t['source']); out['textures'].append(t); tex_map[i] = len(out['textures']) - 1
        return tex_map[i]
    def material(i):
        if i not in mat_map:
            m = json.loads(json.dumps(js['materials'][i]))
            for key in ('occlusionTexture', 'normalTexture', 'emissiveTexture'):
                if key in m: m[key]['index'] = texture(m[key]['index'])
            if 'baseColorTexture' in m.get('pbrMetallicRoughness', {}): m['pbrMetallicRoughness']['baseColorTexture']['index'] = texture(m['pbrMetallicRoughness']['baseColorTexture']['index'])
            out['materials'].append(m); mat_map[i] = len(out['materials']) - 1
        return mat_map[i]
    for n in js['nodes']:
        if n['name'] not in node_names: continue
        mesh, tr, sc = quantize_mesh(js, bin_, js['meshes'][n['mesh']], b)
        for p in mesh['primitives']: p['material'] = material(p['material'])
        out['meshes'].append(mesh)
        out['nodes'].append({'name': n['name'], 'mesh': len(out['meshes']) - 1, 'translation': tr, 'scale': sc}); out['scenes'][0]['nodes'].append(len(out['nodes']) - 1)
    out['buffers'] = [{'byteLength': len(b.bin)}]
    return out, b.bin

js, bin_ = read_glb(src)
names = [n['name'] for n in js['nodes']]
deco = [n for n in names if n.startswith('deco_')]; cab = [n for n in names if n not in deco]
print('cabinet nodes', cab, '| ornament nodes', deco)
for kind, nodes, name in (('cabinet', cab, 'claw-cabinet.glb'), ('deco', deco, 'claw-cabinet-deco.glb')):
    o, bb = build(js, bin_, nodes, kind)
    size = write_glb(os.path.join(out_dir, name), o, bb)
    print(f"  wrote {name}: {size//1024} KB")
