"""Xuất mèo Blender (tools/blender/meo.py) thành dữ liệu cho engine của game: meo-blender.bin.
Chạy từ thư mục gốc repo:
  blender --background --factory-startup --python tools/blender/meo.py          # dựng meo.blend (không commit)
  blender --background tools/blender/meo.blend --python tools/blender/xuat-web.py
Lông của Blender không đưa lên web được: chỉ xuất độ dài lông từng đỉnh, game tự đắp lông nhiều lớp.
Hệ trục game: Y lên, mèo nhìn +Z  =>  (x, y, z)game = SC * (x, z, -(y - OY))blender."""
import bpy, json, math, os, struct
from array import array
from mathutils import Vector, Matrix, Quaternion

V = Vector
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'meo-blender.bin')
SC, OY = .2, .12
A = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))          # trục Blender -> game
EYE_R, LID_CLOSE = .185, math.radians(98)

D = bpy.data
rig = D.objects['Xuong_Meo']
arm = rig.data
arm.pose_position = 'REST'
bpy.context.view_layer.update()


def gp(p):
    return A @ (V(p) - V((0, OY, 0))) * SC


def smooth01(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def srgb(c):
    return tuple(max(0.0, min(1.0, k)) ** (1 / 2.2) for k in c)


def bbox_center(o):
    pts = [o.matrix_world @ V(c) for c in o.bound_box]
    return sum(pts, V()) / 8


# ───── xương xuất ra: mọi xương biến dạng, trừ hàm (gộp vào đầu) ─────
BONES = [b.name for b in arm.bones if b.use_deform and b.name != 'jaw']
BI = {n: i for i, n in enumerate(BONES)}
BI['jaw'] = BI['head']
assert len(BONES) <= 40, len(BONES)

EYES = {s: bbox_center(D.objects['Mat_' + sn]) for s, sn in ((1, 'L'), (-1, 'R'))}
NOSE = bbox_center(D.objects['Mui'])
TAIL = [V(p) for p in [(0, 1.72, 2.22), (0, 2.18, 2.34), (0, 2.58, 2.62), (0, 2.86, 3.02),
                       (0, 2.94, 3.48), (0, 2.82, 3.90), (0, 2.56, 4.18)]]
FUR_MAX = .27


def fur_len(p):
    """chiều dài lông (đơn vị Blender) theo vùng, cùng quy luật với meo.py"""
    x, y, z = p
    L = .16
    if y < -1.15 and z > 2.55:
        r = (p - NOSE).length
        L = .035 + .12 * smooth01(.15, .75, r)
        if abs(x) > .42 and z < 3.1:
            L = .19
    elif -1.45 < y < -.55 and z > 1.55:
        L = .24
    elif y > 1.85 and z > 2.1:
        L = .27
    elif z < 1.5 and not (-.5 < y < .65 and z > 1.15):
        L = .09 if z >= .4 else .04
    elif z < 1.55:
        L = .2
    for c in EYES.values():
        d = (p - c).length
        if d < EYE_R * 1.9:
            L = min(L, .012 + .1 * smooth01(EYE_R * 1.15, EYE_R * 1.9, d))
        if p.y < c.y + .08 and V((p.x - c.x, p.z - c.z)).length < EYE_R * 1.06:
            L = 0
    L *= smooth01(.07, .2, (p - NOSE).length)
    return L


def decimated(obj, target_tris, tag):
    """bản sao lưới (dáng nghỉ, hệ world) đã giảm tam giác, giữ trọng số + màu"""
    dg = bpy.context.evaluated_depsgraph_get()
    if tag == 'raw':                      # thân: dữ liệu gốc, giữ nguyên nhóm trọng số
        me = obj.data.copy()
        me.transform(obj.matrix_world)
    else:
        me = D.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        me.transform(obj.matrix_world)
    tmp = D.objects.new('tmp', me)
    bpy.context.scene.collection.objects.link(tmp)
    for g in obj.vertex_groups:
        tmp.vertex_groups.new(name=g.name)
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    if n > target_tris:
        m = tmp.modifiers.new('giam', 'DECIMATE')
        m.ratio = target_tris / n
        dg = bpy.context.evaluated_depsgraph_get()
        me = D.meshes.new_from_object(tmp.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.calc_loop_triangles()
    return tmp, me


def colors_of(me, obj):
    a = me.color_attributes.get('col')
    if a:
        return [srgb(a.data[i].color[:3]) for i in range(len(me.vertices))]
    base = obj.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
    return [srgb(base[:3])] * len(me.vertices)


# ───── 1. lưới xương (có lông): thân + tai + đệm chân ─────
skin = {'P': [], 'N': [], 'C': [], 'B': [], 'W': [], 'I': []}


def skin_add(me, cols, alphas, weights):
    base = len(skin['P'])
    for i, v in enumerate(me.vertices):
        skin['P'].append(gp(v.co))
        skin['N'].append((A @ v.normal).normalized())
        skin['C'].append((*cols[i], alphas[i]))
        w = sorted(weights[i], key=lambda q: -q[1])[:4]
        tot = sum(k for _, k in w) or 1
        w = [(b, k / tot) for b, k in w] + [(0, 0)] * (4 - len(w))
        skin['B'].append([b for b, _ in w])
        skin['W'].append([k for _, k in w])
    for t in me.loop_triangles:
        skin['I'].extend(base + i for i in t.vertices)


body = D.objects['Da_Meo']
tmp, me = decimated(body, 26000, 'raw')
names = {g.index: g.name for g in tmp.vertex_groups}
weights = []
for v in me.vertices:
    acc = {}
    for g in v.groups:
        nm = names.get(g.group)
        if nm in BI and g.weight > .001:
            acc[BI[nm]] = acc.get(BI[nm], 0) + g.weight
    weights.append(list(acc.items()) or [(BI['spine'], 1)])
skin_add(me, colors_of(me, body), [min(1, fur_len(v.co) / FUR_MAX) for v in me.vertices], weights)
print('THAN', len(me.vertices))

for sn in 'LR':
    o = D.objects['Tai_' + sn]
    _, me = decimated(o, 1500, 'eval')
    cols = colors_of(me, o)
    alpha = [(.04 if c[0] > .8 and c[2] > .5 and c[1] < .75 else .17) for c in cols]   # lòng tai hồng: gần trụi
    skin_add(me, cols, alpha, [[(BI['ear.' + sn], 1)]] * len(me.vertices))

for o in [o for o in D.objects if o.name.startswith('Dem_')]:
    bone = o.parent_bone
    _, me = decimated(o, 90, 'eval')
    skin_add(me, colors_of(me, o), [0] * len(me.vertices), [[(BI[bone], 1)]] * len(me.vertices))
print('LUOI_XUONG', len(skin['P']), 'dinh', len(skin['I']) // 3, 'tam giac')
assert len(skin['P']) < 65535


# ───── 2. phần cứng theo xương đầu: mắt, mí, mũi, miệng, ria ─────
def rigid():
    return {'P': [], 'N': [], 'C': [], 'R': [], 'I': []}


def rigid_add(dst, pts, nrms, cols, rough, kind, tris, glow=0.0):
    base = len(dst['P'])
    for p, n, c in zip(pts, nrms, cols):
        dst['P'].append(gp(p))
        dst['N'].append((A @ n).normalized())
        dst['C'].append((*c, glow))
        dst['R'].append((rough, kind))
    for t in tris:
        dst['I'].extend(base + i for i in t)


def rigid_obj(dst, o, target, rough, kind, glow=0.0):
    _, me = decimated(o, target, 'eval')
    rigid_add(dst, [v.co for v in me.vertices], [v.normal for v in me.vertices], colors_of(me, o), rough, kind,
              [t.vertices for t in me.loop_triangles], glow)


face = rigid()
rigid_obj(face, D.objects['Mui'], 700, .45, 0)
rigid_obj(face, D.objects['Mieng'], 600, .8, 0)
rigid_obj(face, D.objects['Ria_Mep'], 2600, .35, 0, .3)
rigid_obj(face, D.objects['Ria_Mat'], 700, .35, 0, .3)


def mixc(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def hexc(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def hash1(i):
    return (math.sin(i * 127.1 + 311.7) * 43758.5453) % 1


eyes, eye_info = [], []
for s, sn in ((1, 'L'), (-1, 'R')):
    c = EYES[s]
    gaze = V((s * .13, -1, 0)).normalized()
    right = gaze.cross(V((0, 0, 1))).normalized()
    up = right.cross(gaze).normalized()
    NR, NS = 40, 64
    # vòng đồng tâm quanh hướng nhìn: mép đồng tử và mép mống mắt rơi đúng vào một vòng nên nét
    angs = [0, .14, .28, .42, .54, .62, .665, .685, .70, .725, .755, .79, .825, .86, .89, .915, .94, .96, .98, 1.0,
            1.03, 1.08, 1.16, 1.3, 1.5, 1.75, 2.05, 2.4, 2.75, math.pi]
    pts, nrms, cols = [], [], []
    for ang in angs:
        for i in range(NS):
            ph = i / NS * 2 * math.pi
            d = gaze * math.cos(ang) + (right * math.cos(ph) + up * math.sin(ph)) * math.sin(ang)
            px, pz = d.dot(right), d.dot(up)
            if ang <= .685:                                                          # đồng tử tròn to
                q = hexc('0b0705')
            elif ang > .99:
                q = mixc(hexc('241109'), hexc('5a3320'), smooth01(1.0, 1.4, ang))
            else:
                t = smooth01(.7, .96, ang)
                q = mixc(hexc('d9a23c'), hexc('8fb04c'), smooth01(.15, .6, t))
                fib = hash1(i) * .6 + hash1(i // 3 + 91) * .4
                q = tuple(k * (.78 + .42 * fib) for k in q)
                q = mixc(q, hexc('f0c35a'), (1 - smooth01(.70, .80, ang)) * .55)      # quầng ấm quanh đồng tử
                q = mixc(q, hexc('f6e08a'), smooth01(.15, .85, -pz / .8) * .35)         # đáy mống mắt hắt sáng
                q = mixc(q, hexc('1a0f0a'), smooth01(.88, .96, ang))                  # viền tối ngoài mống mắt
            sh = 1 - .62 * smooth01(.1, .78, pz)                                     # bóng mí trên đổ xuống
            q = (q[0] * sh, q[1] * sh, q[2] * min(1, sh * 1.04))
            pts.append(c + d * EYE_R)
            nrms.append(d)
            cols.append(tuple(max(0, min(1, k)) for k in q))
    tris = []
    for j in range(len(angs) - 1):
        for i in range(NS):
            a, b = j * NS + i, j * NS + (i + 1) % NS
            tris += [(a, a + NS, b + NS), (a, b + NS, b)]
    eye = rigid()
    rigid_add(eye, pts, nrms, cols, .1, 6, tris)
    eyes.append(eye)
    eye_info.append({'c': list(gp(c))})
    # đốm sáng: đứng yên khi tròng mắt liếc, nằm chung nhóm mặt
    for off, rr in (((.30, .40), .17), ((-.30, -.30), .065)):
        d0 = (gaze + right * off[0] * .75 + up * off[1] * .75).normalized()
        t1 = d0.orthogonal().normalized()
        t2 = d0.cross(t1)
        ring = [c + d0 * EYE_R * 1.022]
        for i in range(18):
            ph = i / 18 * 2 * math.pi
            e = (d0 + (t1 * math.cos(ph) + t2 * math.sin(ph)) * rr * .62).normalized()
            ring.append(c + e * EYE_R * 1.016)
        rigid_add(face, ring, [d0] * len(ring), [(1, 1, 1)] * len(ring), .1, 0,
                  [(0, 1 + i, 1 + (i + 1) % 18) for i in range(18)], 1.0)
    # viền mi: vòng tối mảnh ôm quanh mắt, đậm ở trên
    ring_pts, ring_n, ring_c, ring_t = [], [], [], []
    SEG, SIDE = 72, 6
    for i in range(SEG):
        ph = i / SEG * 2 * math.pi
        d0 = (gaze * math.cos(.99) + (right * math.cos(ph) + up * math.sin(ph) * .96) * math.sin(.99)).normalized()
        thick = EYE_R * (.028 + .035 * max(0, math.sin(ph)))
        tang = (-right * math.sin(ph) + up * math.cos(ph)).normalized()
        b1 = tang.cross(d0).normalized()
        for k in range(SIDE):
            a = k / SIDE * 2 * math.pi
            n = d0 * math.cos(a) + b1 * math.sin(a)
            ring_pts.append(c + d0 * EYE_R * 1.012 + n * thick)
            ring_n.append(n)
            ring_c.append(hexc('2a140c'))
    for i in range(SEG):
        for k in range(SIDE):
            a, b = i * SIDE + k, i * SIDE + (k + 1) % SIDE
            na, nb = (a + SIDE) % (SEG * SIDE), (b + SIDE) % (SEG * SIDE)
            ring_t += [(a, na, nb), (a, nb, b)]
    rigid_add(face, ring_pts, ring_n, ring_c, .75, 0, ring_t)

lids = []
for s, sn in ((1, 'L'), (-1, 'R')):
    lid = rigid()
    rigid_obj(lid, D.objects['Mi_' + sn], 900, .85, 0)
    lids.append(lid)
print('MAT', [len(e['P']) for e in eyes], 'MAT_PHU', len(face['P']), 'MI', [len(e['P']) for e in lids])

# ───── 3. chuyển động ─────
pb = rig.pose.bones
REST = {b.name: b.matrix_local.copy() for b in arm.bones}


def sample():
    """ma trận biến dạng từng xương trong hệ game -> (quat xyzw, tịnh tiến)"""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = rig.evaluated_get(dg)
    out = []
    O = V((0, OY, 0))
    for n in BONES:
        m = ev.pose.bones[n].matrix @ REST[n].inverted()
        R, t = m.to_quaternion().to_matrix(), m.to_translation()
        Rg = A @ R @ A.transposed()
        tg = A @ (R @ O + t - O) * SC
        out.append((Rg.to_quaternion(), tg))
    return out


def clip(name, frames, loop, extra=None):
    prev = None
    data = []
    for fr in frames:
        row = []
        for i, (q, t) in enumerate(fr):
            if prev and q.dot(prev[i][0]) < 0:
                q = -q
            row.append((q, t))
        prev = row
        data.append(row)
    c = {'name': name, 'n': len(data), 'loop': loop, 'data': data}
    c.update(extra or {})
    return c


clips = []
# 3a. đi bộ: đúng hoạt ảnh Blender, một chu kỳ 48 khung
arm.pose_position = 'POSE'
keys = []
for f in range(1, 49):
    bpy.context.scene.frame_set(f)
    keys.append({b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in pb})
rig.animation_data_clear()
for b in pb:
    b.rotation_mode = 'QUATERNION'
# sải chân gốc quá ngắn để đi lại trong phòng: nới bước bàn chân, hạ thân thêm chút cho chân đủ tầm
STRIDE_K, CROUCH = 1.65, .07
frames = []
for key in keys:
    for b in pb:
        loc, rot = key[b.name]
        b.location, b.rotation_quaternion = loc, rot
        if b.name.startswith('ik_') or b.name == 'hips':
            m = arm.bones[b.name].matrix_local.to_3x3()
            d = m @ loc
            if b.name == 'hips':
                d.z -= CROUCH
            else:
                d.y *= STRIDE_K
            b.location = m.inverted() @ d
    frames.append(sample())
# quãng đường một chu kỳ = sải / phần thời gian chân trụ -> game chạy pha theo quãng đường nên không trượt chân
clips.append(clip('walk', frames, True, {'dist': round(.52 * STRIDE_K / .66 * SC, 4), 'sec': .62}))


def reset():
    for b in pb:
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)          # gán pb.matrix có thể để lại sai số tỉ lệ, cộng dồn qua các khung


def set_rot(name, *turns):
    """turns: (trục trong hệ Blender lúc nghỉ, góc)... áp lần lượt"""
    R = arm.bones[name].matrix_local.to_quaternion()
    q = Quaternion()
    for axis, ang in turns:
        q = Quaternion(V(axis), ang) @ q
    pb[name].rotation_quaternion = R.inverted() @ q @ R


def set_loc(name, delta):
    pb[name].location = arm.bones[name].matrix_local.to_3x3().inverted() @ V(delta)


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
TAILS = [n for n in BONES if n.startswith('tail.')]
LAST = {}


def pose(k_sit, u):
    """k_sit: 0 đứng -> 1 ngồi.  u: pha 0..1 của nhịp thở/ngó nghiêng"""
    reset()
    w = 2 * math.pi * u
    k = k_sit
    br = math.sin(w * 2)
    # hông hạ + xoay: mông chạm đất, ngực dựng lên. Âm quanh X = phía trước ngẩng lên
    lift = -.60 * k
    set_loc('hips', (0, -.22 * k, -1.08 * k + br * .008))
    set_rot('hips', (X, lift))
    set_rot('spine', (X, -.07 * k + br * .006))
    set_rot('chest', (X, -.03 * k - br * .008))
    look = math.sin(w) * (1 - .0 * k)
    tilt = math.sin(w + 1.9)
    set_rot('neck', (X, .30 * k + br * .006), (Z, look * .10))
    set_rot('head', (X, .40 * k + math.sin(w * 2 + .8) * .02), (Y, tilt * .07), (Z, look * .22))
    for sn, s in (('L', 1), ('R', -1)):
        # bàn trước đứng yên dưới ngực (lùi nhẹ khi ngồi)
        set_loc('ik_front.' + sn, (-s * .06 * k, .06 * k, 0))
        # bàn sau: cổ chân nằm dọc mặt đất, đưa ra trước hai bên sườn
        set_loc('ik_hind.' + sn, (s * .16 * k, -.50 * k, -.46 * k))
        set_rot('ik_hind.' + sn, (X, -.95 * k))
        set_rot('h_toe.' + sn, (X, .0))
    tw = math.exp(-((u - .62) / .018) ** 2)
    set_rot('ear.L', (Y, tw * .30))
    set_rot('ear.R', (Y, -math.exp(-((u - .2) / .018) ** 2) * .24))
    for i, n in enumerate(TAILS):
        f = i / (len(TAILS) - 1)
        sway = math.sin(w * 2 - i * .42) * (.020 + .035 * f)
        set_rot(n, (Z, sway), (Y, sway))
    if k > 0:
        lay_tail(k, w)


def lay_tail(k, w):
    """ngồi: đuôi thả xuống sàn rồi quặp vòng sang một bên. Đặt hướng từng đốt trong không gian
    (từ gốc ra chóp) nên không bị cộng dồn góc."""
    for i, n in enumerate(TAILS):
        bpy.context.view_layer.update()
        b = pb[n]
        head = b.matrix.to_translation()
        cur = b.matrix.to_3x3().col[1].normalized()
        az = max(0, i - 1) * .27 + math.sin(w * 2 - i * .5) * .012 * i     # chóp đuôi ngoe nguẩy nhẹ
        # độ dốc theo độ cao: còn cao thì chúc xuống, chạm sàn thì nằm ngang
        el = max(-.85, min(.25, (.24 - head.z) * 2.2))
        aim = V((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
        q = Quaternion().slerp(cur.rotation_difference(aim), k)
        b.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ b.matrix
        b.scale = (1, 1, 1)


def frames_of(fn, n, closed):
    out = []
    for i in range(n):
        fn(i / n if closed else i / (n - 1))
        out.append(sample())
    return out


clips.append(clip('stand', frames_of(lambda u: pose(0, u), 96, True), True, {'sec': 7.0}))
ease = lambda t: t * t * (3 - 2 * t)
clips.append(clip('sitdown', frames_of(lambda t: pose(ease(t), 0), 24, False), False, {'sec': .9}))
clips.append(clip('sit', frames_of(lambda u: pose(1, u), 96, True), True, {'sec': 7.0}))

# ───── 4. ghi tệp: [u32 độ dài JSON][JSON][nhị phân] ─────
blob = bytearray()


def put(typecode, values):
    while len(blob) % 4:
        blob.append(0)
    off = len(blob)
    a = array(typecode, values)
    blob.extend(a.tobytes())
    return [typecode, off, len(a)]


def i16(v, k):
    return max(-32767, min(32767, int(round(v / k * 32767))))


PK = 2.0   # toạ độ nằm trong ±PK


def pack_mesh(m):
    d = {'P': put('h', [i16(k, PK) for p in m['P'] for k in p]),
         'N': put('b', [int(round(k * 127)) for p in m['N'] for k in p]),
         'C': put('B', [int(round(max(0, min(1, k)) * 255)) for p in m['C'] for k in p]),
         'I': put('H', m['I'])}
    if 'B' in m:
        d['B'] = put('B', [k for p in m['B'] for k in p])
        d['W'] = put('B', [int(round(k * 255)) for p in m['W'] for k in p])
    if 'R' in m:
        d['R'] = put('f', [k for p in m['R'] for k in p])
    return d


meta = {'v': 1, 'posK': PK, 'bones': BONES,
        'fur': {'n': 18, 'len': round(FUR_MAX * SC * .8, 4), 'den': 1100},
        'skin': pack_mesh(skin), 'face': pack_mesh(face), 'eyes': [pack_mesh(e) for e in eyes],
        'lids': [pack_mesh(e) for e in lids], 'eyeInfo': eye_info, 'lidClose': LID_CLOSE,
        'headBone': BI['head'], 'headPos': list(gp((0, -1.5, 3.2))), 'clips': []}
for c in clips:
    vals = []
    for row in c.pop('data'):
        for q, t in row:
            vals += [i16(q.x, 1), i16(q.y, 1), i16(q.z, 1), i16(q.w, 1), i16(t.x, PK), i16(t.y, PK), i16(t.z, PK)]
    c['data'] = put('h', vals)
    meta['clips'].append(c)

js = json.dumps(meta, separators=(',', ':')).encode()
while (4 + len(js)) % 4:
    js += b' '
with open(OUT, 'wb') as fh:
    fh.write(struct.pack('<I', len(js)) + js + bytes(blob))
print('XONG', os.path.normpath(OUT), round(os.path.getsize(OUT) / 1024), 'KB')
