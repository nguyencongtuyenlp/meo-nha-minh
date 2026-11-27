"""Dựng mèo con vằn cam: da liền khối, mắt/tai/mũi/ria, xương + IK, lông, chu kỳ đi bộ.
Chạy: Blender --background --factory-startup --python meo.py
Mèo quay mặt về -Y, Z hướng lên."""
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Quaternion, noise

random.seed(7)
HERE = os.path.dirname(os.path.abspath(__file__))
V = Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def link(o):
    col.objects.link(o)
    return o


def active(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def smooth01(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def lin(r, g, b):  # sRGB 0-255 -> linear
    return tuple((c / 255) ** 2.2 for c in (r, g, b))


ORANGE, DARK, CREAM = lin(222, 143, 72), lin(150, 78, 32), lin(250, 240, 224)
PINK, DPINK = lin(236, 150, 150), lin(190, 95, 100)


def material(name, color=(1, 1, 1), rough=0.5, attr=None, emit=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = 0.03
    if emit:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = emit
    if attr:
        a = nt.nodes.new('ShaderNodeAttribute')
        a.attribute_name = attr
        nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
    return m


def mesh_obj(name, verts, faces, mat, colors=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    if colors:
        a = me.color_attributes.new('col', 'FLOAT_COLOR', 'POINT')
        for i, c in enumerate(colors):
            a.data[i].color = (*c, 1)
    return link(bpy.data.objects.new(name, me))


# ───────────────────────── 1. DA (thân liền khối) ─────────────────────────
bm = bmesh.new()


def ball(c, r, s=(1, 1, 1)):
    mtx = Matrix.Translation(V(c)) @ Matrix.Diagonal((r * s[0], r * s[1], r * s[2], 1))
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1, matrix=mtx)


def chain(pts):
    """pts: [(point, radius)] -> ống thuôn làm từ nhiều cầu chồng nhau"""
    for (a, ra), (b, rb) in zip(pts, pts[1:]):
        a, b = V(a), V(b)
        n = max(2, int((b - a).length / (min(ra, rb) * 0.22)))
        for i in range(n + 1):
            t = i / n
            ball(a.lerp(b, t), ra + (rb - ra) * t)


# thân: mông - bụng - ngực
chain([((0, 1.22, 2.0), .66), ((0, .45, 1.92), .68), ((0, -.45, 2.04), .68)])
ball((0, -.62, 1.86), .55)
# cổ
chain([((0, -.68, 2.28), .52), ((0, -1.18, 2.86), .46)])
# đầu mèo con: to, tròn, má phính
ball((0, -1.45, 3.17), .72, (1.04, .93, .90))
for s in (-1, 1):
    ball((s * .36, -1.62, 2.96), .34, (1.1, .95, .88))
    ball((s * .13, -1.99, 2.90), .19, (1.05, .95, .85))   # gò ria
    ball((s * .40, -1.42, 3.56), .17)                     # gốc tai
ball((0, -1.90, 2.76), .16, (1.1, 1, .75))                 # cằm
ball((0, -1.96, 3.02), .15, (.8, 1, 1.1))                  # sống mũi

TOES = []
for s in (-1, 1):
    # chân trước: vai - khuỷu - cổ chân - bàn
    chain([((s * .34, -.62, 2.02), .40), ((s * .40, -.50, 1.28), .235),
           ((s * .40, -.66, .46), .175), ((s * .40, -.76, .23), .20)])
    # chân sau: hông - gối - khuỷu gót - bàn
    chain([((s * .34, 1.18, 1.98), .52), ((s * .50, .80, 1.30), .30),
           ((s * .48, 1.46, .70), .175), ((s * .48, 1.24, .24), .185)])
    for x, y in ((s * .40, -.88), (s * .48, 1.12)):
        ball((x, y + .05, .20), .21, (1.15, 1.1, .82))
        for k in range(4):                                # 4 ngón mỗi bàn
            tx = x + (k - 1.5) * .105
            ty = y - .14 + abs(k - 1.5) * .045
            ball((tx, ty, .13), .082, (.95, 1.2, 1))
            TOES.append(V((tx, ty, .13)))

TAIL = [V(p) for p in [(0, 1.72, 2.22), (0, 2.18, 2.34), (0, 2.58, 2.62), (0, 2.86, 3.02),
                       (0, 2.94, 3.48), (0, 2.82, 3.90), (0, 2.56, 4.18)]]
chain(list(zip(TAIL, (.27, .22, .20, .195, .185, .17, .13))))

me = bpy.data.meshes.new('Da')
bm.to_mesh(me)
bm.free()
body = link(bpy.data.objects.new('Da_Meo', me))
active(body)
m = body.modifiers.new('remesh', 'REMESH')
m.mode, m.voxel_size = 'VOXEL', 0.04
bpy.ops.object.modifier_apply(modifier='remesh')
m = body.modifiers.new('smooth', 'SMOOTH')
m.factor, m.iterations = 0.6, 8
bpy.ops.object.modifier_apply(modifier='smooth')
me = body.data


def surf_y(x, z):
    hit, loc, _, _ = body.ray_cast(V((x, -5, z)), V((0, 1, 0)))
    return loc.y if hit else -2.0


EYE_R = .185
EYES = {s: V((s * .275, surf_y(s * .275, 3.19) + EYE_R * .70, 3.19)) for s in (-1, 1)}
# hốc mắt: kéo da quanh mắt lùi nhẹ vào trong
for v in me.vertices:
    for c in EYES.values():
        d = V((v.co.x - c.x, v.co.z - c.z)).length
        if v.co.y < c.y and d < EYE_R * 1.25:
            v.co.y += .075 * (1 - smooth01(EYE_R * .55, EYE_R * 1.25, d))
NOSE = V((0, surf_y(0, 3.0), 3.0))


def coat_color(p):
    x, y, z = p
    n = noise.noise(p * 2.3)
    n2 = noise.noise(p * 7.0)
    c = ORANGE
    st = 0.0
    if y > -.95 and z > .55:                      # vằn thân + chân
        if abs(x) < .75 and z > 1.5:
            st = smooth01(.45, .85, math.sin(y * 8.5 + n * 2.2 + abs(x) * 1.6)) * smooth01(1.75, 2.2, z)
        else:
            st = smooth01(.65, .95, math.sin(z * 12 + n * 2)) * .8
    if y > 1.85 and z > 2.1:                      # khoang đuôi
        st = smooth01(.2, .7, math.sin((y + z) * 8 + n))
    if y < -1.35 and z > 3.28:                    # chữ M trên trán
        w = abs(x) + math.sin(z * 14) * .025
        st = max(math.exp(-((w - k) / .032) ** 2) for k in (0.02, .17, .34)) * smooth01(3.33, 3.45, z)
    if y < -1.2 and 2.8 < z < 3.22 and abs(x) > .45:  # vệt má
        st = smooth01(.7, .95, math.sin((z - abs(x) * .25) * 30))
    c = mix(c, DARK, st * .9)
    # vùng trắng kem
    w = 0.0
    for q, r in ((V((.12, -2.1, 2.88)), .30), (V((-.12, -2.1, 2.88)), .30), (V((0, -1.97, 2.72)), .34),
                 (V((0, -1.25, 2.35)), .62), (V((0, -.92, 1.85)), .55)):
        w = max(w, 1 - smooth01(r * .7, r, (p - q).length + n * .05))
    if -.5 < y < 1.0 and abs(x) < .6:
        w = max(w, 1 - smooth01(1.35, 1.65, z + n * .1))   # bụng
    w = max(w, 1 - smooth01(.48, .68, z + n * .08))        # tất trắng
    if y > 2.5 and z > 3.95:
        w = max(w, smooth01(3.95, 4.15, z + n * .08))      # chóp đuôi
    c = mix(c, CREAM, w)
    k = 1 + n2 * .13
    if z < .3:                                      # kẽ ngón chân
        d = sorted(V((p.x - t.x, p.y - t.y)).length for t in TOES)
        if d[1] < .11:
            k *= 1 - .38 * (1 - smooth01(.004, .035, d[1] - d[0]))
    return tuple(max(0, min(1, v * k)) for v in c)


vcols = [coat_color(v.co.copy()) for v in me.vertices]
ca = me.color_attributes.new('col', 'FLOAT_COLOR', 'POINT')
for i, c in enumerate(vcols):
    ca.data[i].color = (*c, 1)
vcols_np = vcols
me.materials.append(material('Da', rough=.75, attr='col'))
for p in me.polygons:
    p.use_smooth = True
active(body)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.002)
bpy.ops.object.mode_set(mode='OBJECT')
me = body.data
me.uv_layers[0].name = 'UVMap'

# ───────────────────────── 2. BỘ PHẬN ─────────────────────────
head_parts = []     # (object, tên xương)
lid_fur = []
LID_CLOSE = math.radians(98)

eye_mat = material('Mat', rough=.08, attr='col', coat=1.0)
glint_mat = material('Dom_Sang', (1, 1, 1), emit=2.5)
lid_mat = material('Mi', rough=.7, attr='col')
dark_mat = material('Vien', lin(48, 24, 18), rough=.6)


def uv_sphere(center, r, ns, nr, dirfn):
    verts, faces = [], []
    for j in range(nr + 1):
        for i in range(ns):
            verts.append(center + dirfn(i / ns, j / nr) * r)
    for j in range(nr):
        for i in range(ns):
            a, b = j * ns + i, j * ns + (i + 1) % ns
            faces.append((a, b, b + ns, a + ns))
    return verts, faces


for s, c in EYES.items():
    sn = 'L' if s > 0 else 'R'
    gaze = V((s * .13, -1, 0)).normalized()
    rot = V((0, 0, 1)).rotation_difference(gaze)

    def d_eye(u, t, rot=rot):
        th, ph = t * math.pi, u * 2 * math.pi
        return rot @ V((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))

    verts, faces = uv_sphere(c, EYE_R, 160, 110, d_eye)
    right = gaze.cross(V((0, 0, 1))).normalized()
    up = right.cross(gaze).normalized()
    cols = []
    for v in verts:
        d = (v - c).normalized()
        ang = math.acos(max(-1, min(1, d.dot(gaze))))
        px, pz = d.dot(right), d.dot(up)
        if ang > 1.02:
            q = lin(120, 70, 40)
        elif ang > .93:
            q = lin(40, 22, 10)                              # viền mống mắt
        elif (px / .40) ** 2 + (pz / .66) ** 2 < 1:
            q = (.002, .002, .002)                           # đồng tử to kiểu mèo con
        else:
            f = noise.noise(V((math.atan2(pz, px) * 9, ang * 3, 0)))
            q = mix(lin(236, 190, 50), lin(105, 150, 55), smooth01(.45, .92, ang))
            q = tuple(max(0, k * (1 + f * .45)) for k in q)
        cols.append(q)
    head_parts.append((mesh_obj('Mat_' + sn, verts, faces, eye_mat, cols), 'head'))
    for off, rr in ((V((-.055, 0, .07)), .030), (V((.05, 0, -.045)), .012)):
        p = c + (gaze * 1.0 + off / EYE_R).normalized() * EYE_R * 1.012
        vv, ff = uv_sphere(p, rr, 20, 12, d_eye)
        nn = (p - c).normalized()
        vv = [v - nn * (v - p).dot(nn) * .75 for v in vv]   # đốm dẹt, không xuyên mí
        head_parts.append((mesh_obj('Dom_' + sn, vv, ff, glint_mat), 'head'))

    # mí trên (xoay được để chớp mắt) và viền mắt dưới
    def d_lid(u, t):
        az = -1.45 + 2.9 * u                  # trái-phải
        el = math.radians(43 + 150 * t)       # từ trước mặt vòng lên đỉnh ra sau
        return V((math.sin(az), -math.cos(az) * math.cos(el), math.cos(az) * math.sin(el)))

    nu, nt = 40, 30
    verts = [c + d_lid(i / nu, j / nt) * EYE_R * 1.07 for j in range(nt + 1) for i in range(nu + 1)]
    faces = [(j * (nu + 1) + i, j * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i)
             for j in range(nt) for i in range(nu)]
    close = Matrix.Rotation(LID_CLOSE, 3, 'X')   # màu mí = màu da tại vị trí khi nhắm
    cols = [lin(70, 36, 22) if k // (nu + 1) < 2 else coat_color(c + close @ (v - c)) for k, v in enumerate(verts)]
    for _ in range(4200):                          # lông mịn trên mí
        u, t = random.random(), random.uniform(.05, .78)
        nn = d_lid(u, t)
        lid_fur.append((c + nn * EYE_R * 1.075, nn, coat_color(c + close @ (nn * EYE_R * 1.07)), .028,
                        V((s * .3, .2, 1)), 'eyelid.' + sn))
    head_parts.append((mesh_obj('Mi_' + sn, verts, faces, lid_mat, cols), 'eyelid.' + sn))


def curve_obj(name, splines, bevel, mat, radii=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution = '3D', bevel, 3
    cu.use_fill_caps = True
    for pts in splines:
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            bp = sp.bezier_points[i]
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
            bp.radius = (1 - .93 * i / (len(pts) - 1)) if radii else 1
    cu.materials.append(mat)
    o = link(bpy.data.objects.new(name, cu))
    active(o)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


# mũi tam giác bo tròn
def d_ball(u, t):
    th, ph = t * math.pi, u * 2 * math.pi
    return V((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))


verts, faces = uv_sphere(V((0, 0, 0)), 1, 48, 32, d_ball)
nose_v, nose_c = [], []
for v in verts:
    wide = .55 + .45 * smooth01(-.9, .7, v.z)
    p = V((v.x * .105 * wide, v.y * .055, v.z * .062))
    p += NOSE + V((0, -.005, 0))
    nose_v.append(p)
    nostril = any(V((v.x - k * .55, (v.z - .05) * 1.5)).length < .27 and v.y < 0 for k in (-1, 1))
    nose_c.append(DPINK if nostril else PINK)
head_parts.append((mesh_obj('Mui', nose_v, faces, material('Mui', rough=.38, attr='col'), nose_c), 'head'))


def on_face(x, z, lift=.006):
    return V((x, surf_y(x, z) - lift, z))


mouth = [[on_face(0, 2.945, .012), on_face(0, 2.90), on_face(0, 2.862)]]
for s in (-1, 1):
    mouth.append([on_face(0, 2.862), on_face(s * .06, 2.828), on_face(s * .13, 2.832), on_face(s * .185, 2.87)])
head_parts.append((curve_obj('Mieng', mouth, .009, dark_mat), 'jaw'))

wh_mat = material('Ria', (.92, .9, .86), rough=.35, emit=.12)
wh, brow = [], []
for s in (-1, 1):
    for k in range(7):
        z = 2.955 - (k % 4) * .033
        x = s * (.15 + (k // 4) * .07)
        a = on_face(x, z, -.02)
        end = V((s * (1.05 + random.random() * .35), a.y + .05 + random.random() * .3, z + .16 - k * .075))
        mid = a.lerp(end, .45) + V((0, -.2, .09))
        wh.append([a, mid, end])
    for k in range(3):
        a = on_face(s * (.2 + k * .055), 3.39, -.01)
        brow.append([a, a + V((s * (.05 + k * .03), -.13, .08)), a + V((s * (.13 + k * .06), -.15, .12 - k * .02))])
head_parts.append((curve_obj('Ria_Mep', wh, .0045, wh_mat, radii=True), 'head'))
head_parts.append((curve_obj('Ria_Mat', brow, .0019, wh_mat, radii=True), 'head'))

# tai: tấm cong, mặt trong hồng, có độ dày
EAR = {}
ear_fur = list(lid_fur)     # (gốc, pháp tuyến, màu, chiều dài, hướng, xương)
for s in (-1, 1):
    sn = 'L' if s > 0 else 'R'
    base = V((s * .43, -1.42, 3.62))
    up = V((s * .36, .02, 1)).normalized()
    side = V((s * 1, -s * .18 * s, -.36 * 1)).normalized() if s > 0 else V((-1, -.18, -.36)).normalized()
    side = (side - up * side.dot(up)).normalized()
    front = V((s * .22, -1, 0)).normalized()
    H, W = .66, .34
    EAR[sn] = (base, base + up * H)

    def ear_pt(t, a, base=base, up=up, side=side, front=front, H=H, W=W):
        w = W * (1 - t ** 1.7) + .018
        return base + up * (t * H - .08) + side * a * w + front * (a * a - .45) * .16 * (1 - t * .7)

    nu, nt = 36, 40
    verts, cols = [], []
    for j in range(nt + 1):
        for i in range(nu + 1):
            t, a = j / nt, i / nu * 2 - 1
            verts.append(ear_pt(t, a))
            inner = (1 - smooth01(.45, .85, abs(a))) * (1 - smooth01(.62, .93, t)) * smooth01(.04, .25, t)
            cols.append(mix(mix(ORANGE, DARK, smooth01(.65, 1, t)), PINK, inner))
    faces = [(j * (nu + 1) + i, j * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i)
             for j in range(nt) for i in range(nu)]
    ear = mesh_obj('Tai_' + sn, verts, faces, material('Tai_' + sn, rough=.95, attr='col'), cols)
    sol = ear.modifiers.new('day', 'SOLIDIFY')
    sol.thickness, sol.offset = .045, 0
    head_parts.append((ear, 'ear.' + sn))
    for _ in range(2600):          # lông tai: mép + lưng
        t, a = random.random(), random.uniform(-1, 1)
        p = ear_pt(t, a)
        ear_fur.append((p + front * -.022, -front, mix(ORANGE, DARK, smooth01(.65, 1, t)), .05,
                        up, 'ear.' + sn))
    for _ in range(7000):          # lông nhung mặt sau + viền mặt trước
        t, a = random.random() ** .9, random.uniform(-1, 1)
        back = random.random() < .72
        if not back and abs(a) < .62 and t < .8:
            a = math.copysign(random.uniform(.62, 1), a)
        p = ear_pt(t, a) + front * (-.024 if back else .024)
        ear_fur.append((p, -front if back else front,
                        mix(ORANGE, DARK, smooth01(.7, 1, t)) if back else mix(ORANGE, CREAM, .25),
                        .045, up, 'ear.' + sn))
    for _ in range(420):
        t = random.random() * .92
        edge = random.choice((-1, 1))
        p = ear_pt(t, edge * random.uniform(.82, 1))
        ear_fur.append((p, (side * edge + front * .5).normalized(), CREAM if edge < 0 else mix(ORANGE, CREAM, .4),
                        .075, up, 'ear.' + sn))
    for _ in range(260):           # chùm lông trắng trong tai
        t, a = random.uniform(.05, .35), random.uniform(-.65, .65)
        p = ear_pt(t, a)
        ear_fur.append((p + front * .025, (front + up).normalized(), CREAM, .14, up, 'ear.' + sn))

# đệm thịt dưới bàn chân
pad_mat = material('Dem_Thit', PINK, rough=.55)
for s in (-1, 1):
    for x, y, tag in ((s * .40, -.88, 'f'), (s * .48, 1.12, 'h')):
        bone = ('f_toe.' if tag == 'f' else 'h_toe.') + ('L' if s > 0 else 'R')
        spots = [((x, y + .02, .045), (.10, .085, .03))]
        spots += [((x + (k - 1.5) * .105, y - .15 + abs(k - 1.5) * .045, .052), (.036, .046, .022)) for k in range(4)]
        for cc, sc in spots:
            vv, ff = uv_sphere(V((0, 0, 0)), 1, 20, 12, d_ball)
            vv = [V((v.x * sc[0], v.y * sc[1], v.z * sc[2])) + V(cc) for v in vv]
            head_parts.append((mesh_obj('Dem_' + bone, vv, ff, pad_mat), bone))

# ───────────────────────── 3. XƯƠNG ─────────────────────────
arm = bpy.data.armatures.new('Xuong')
rig = link(bpy.data.objects.new('Xuong_Meo', arm))
active(rig)
bpy.ops.object.mode_set(mode='EDIT')


def bone(name, head, tail, parent=None, deform=True, connect=False):
    b = arm.edit_bones.new(name)
    b.head, b.tail = V(head), V(tail)
    if parent:
        b.parent = arm.edit_bones[parent]
        b.use_connect = connect
    b.use_deform = deform
    return b


bone('root', (0, .3, 0), (0, .3, .5), deform=False)
bone('hips', (0, .85, 2.0), (0, 1.65, 2.1), 'root')
bone('spine', (0, .85, 2.0), (0, .1, 1.98), 'hips')
bone('chest', (0, .1, 1.98), (0, -.7, 2.15), 'spine', connect=True)
bone('neck', (0, -.7, 2.15), (0, -1.2, 2.8), 'chest', connect=True)
bone('head', (0, -1.2, 2.8), (0, -1.55, 3.45), 'neck', connect=True)
bone('jaw', (0, -1.5, 2.82), (0, -2.05, 2.76), 'head')
for sn, s in (('L', 1), ('R', -1)):
    bone('ear.' + sn, EAR[sn][0], EAR[sn][1], 'head')
    c = EYES[s]
    bone('eyelid.' + sn, c, c + V((.22, 0, 0)), 'head', deform=False)
    # chân trước
    bone('scapula.' + sn, (s * .18, -.35, 2.38), (s * .36, -.66, 1.96), 'chest')
    bone('f_upper.' + sn, (s * .36, -.66, 1.96), (s * .40, -.44, 1.28), 'scapula.' + sn, connect=True)
    bone('f_lower.' + sn, (s * .40, -.44, 1.28), (s * .40, -.66, .44), 'f_upper.' + sn, connect=True)
    bone('f_paw.' + sn, (s * .40, -.66, .44), (s * .40, -.84, .18), 'f_lower.' + sn, connect=True)
    bone('f_toe.' + sn, (s * .40, -.84, .18), (s * .40, -1.12, .13), 'f_paw.' + sn, connect=True)
    bone('ik_front.' + sn, (s * .40, -.66, .44), (s * .40, -.84, .18), 'root', deform=False)
    # chân sau
    bone('h_thigh.' + sn, (s * .34, 1.2, 2.02), (s * .50, .74, 1.30), 'hips')
    bone('h_shin.' + sn, (s * .50, .74, 1.30), (s * .48, 1.50, .70), 'h_thigh.' + sn, connect=True)
    bone('h_hock.' + sn, (s * .48, 1.50, .70), (s * .48, 1.18, .19), 'h_shin.' + sn, connect=True)
    bone('h_toe.' + sn, (s * .48, 1.18, .19), (s * .48, .86, .13), 'h_hock.' + sn, connect=True)
    bone('ik_hind.' + sn, (s * .48, 1.50, .70), (s * .48, 1.18, .19), 'root', deform=False)
tail_names = []
prev = 'hips'
tp = [V((0, 1.65, 2.14))] + TAIL[1:]
tp = [x for a, b in zip(tp, tp[1:]) for x in (a, a.lerp(b, .5))] + [tp[-1]]
for i in range(len(tp) - 1):
    n = 'tail.%02d' % i
    bone(n, tp[i], tp[i + 1], prev, connect=i > 0)
    tail_names.append(n)
    prev = n
bpy.ops.object.mode_set(mode='OBJECT')

# gắn da: trọng số tự động
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unweighted = sum(1 for v in body.data.vertices if not any(g.weight > .001 for g in v.groups))
print('UNWEIGHTED', unweighted, 'of', len(body.data.vertices))
if unweighted > len(body.data.vertices) * .01:
    raise SystemExit('auto weight lỗi')
# mặt giữ cứng theo xương đầu để mắt/mũi/ria không trượt khỏi da
hg = body.vertex_groups['head']
for v in body.data.vertices:
    p = v.co
    k = (1 - smooth01(-1.72, -1.38, p.y)) * smooth01(2.55, 2.78, p.z)
    k = max(k, smooth01(3.15, 3.4, p.z) * (1 - smooth01(-1.2, -.9, p.y)))
    if k > .001:
        old = [(g.group, g.weight) for g in v.groups]
        tot = sum(w for _, w in old) or 1
        for gi, w in old:
            body.vertex_groups[gi].add([v.index], w / tot * (1 - k), 'REPLACE')
        cur = next((g.weight for g in v.groups if g.group == hg.index), 0)
        hg.add([v.index], cur + k, 'REPLACE')
active(body)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)


def bone_parent(o, bname):
    mw = o.matrix_world.copy()
    o.parent, o.parent_type, o.parent_bone = rig, 'BONE', bname
    b = arm.bones[bname]
    o.matrix_parent_inverse = (rig.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
    o.matrix_world = mw


for o, bname in head_parts:
    bone_parent(o, bname)

# IK
for sn in 'LR':
    for chain_bone, target, follow in (('f_lower.', 'ik_front.', 'f_paw.'), ('h_shin.', 'ik_hind.', 'h_hock.')):
        c = rig.pose.bones[chain_bone + sn].constraints.new('IK')
        c.target, c.subtarget, c.chain_count = rig, target + sn, 2
        c = rig.pose.bones[follow + sn].constraints.new('COPY_ROTATION')
        c.target, c.subtarget = rig, target + sn

# ───────────────────────── 4. LÔNG ─────────────────────────
hair_mat = bpy.data.materials.new('Long')
hair_mat.use_nodes = True
nt = hair_mat.node_tree
nt.nodes.remove(nt.nodes['Principled BSDF'])
hb = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
hb.parametrization = 'COLOR'
hb.inputs['Roughness'].default_value = .38
hb.inputs['Radial Roughness'].default_value = .6
at = nt.nodes.new('ShaderNodeAttribute')
at.attribute_name = 'hcol'
nt.links.new(at.outputs['Color'], hb.inputs['Color'])
nt.links.new(hb.outputs[0], nt.nodes['Material Output'].inputs['Surface'])

NPT = 5


def make_curves(name, strands):
    """strands: [(điểm[NPT], màu, uv, bán kính gốc)]"""
    cu = bpy.data.hair_curves.new(name)
    cu.add_curves([NPT] * len(strands))
    pos = [c for s in strands for p in s[0] for c in p]
    cu.attributes['position'].data.foreach_set('vector', pos)
    ra = cu.attributes.get('radius') or cu.attributes.new('radius', 'FLOAT', 'POINT')
    ra.data.foreach_set('value', [s[3] * (1 - .9 * i / (NPT - 1)) for s in strands for i in range(NPT)])
    a = cu.attributes.new('hcol', 'FLOAT_COLOR', 'CURVE')
    a.data.foreach_set('color', [c for s in strands for c in (*s[1], 1.0)])
    if strands[0][2] is not None:
        a = cu.attributes.new('surface_uv_coordinate', 'FLOAT2', 'CURVE')
        a.data.foreach_set('vector', [c for s in strands for c in s[2]])
    cu.materials.append(hair_mat)
    return link(bpy.data.objects.new(name, cu))


def strand(p, n, flow, length, lift):
    t = flow - n * flow.dot(n)
    if t.length < 1e-4:
        t = n.orthogonal()
    t.normalize()
    jit = V((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * .22
    clump = noise.noise_vector(p * 9) * .28
    d = (t * (1 - lift) + n * lift + jit + clump).normalized()
    L = length * random.uniform(.7, 1.25)
    pts = []
    for i in range(NPT):
        s = i / (NPT - 1)
        pts.append(p + d * L * s + t * L * .22 * s * s - n * L * .06 * s * s + V((0, 0, -L * .10 * s * s)))
    return pts


def fur_params(p):
    """(chiều dài, độ dựng, hướng chải)"""
    x, y, z = p
    flow = V((x * .15, 1, -.45))
    L, lift = .16, .32
    if y < -1.15 and z > 2.55:                       # đầu: lông chải từ mũi ra ngoài
        r = (p - NOSE).length
        flow = (p - NOSE) + V((0, .25, -.05))
        L = .035 + .12 * smooth01(.15, .75, r)
        lift = .28
        if abs(x) > .42 and z < 3.1:
            L = .19                                  # má xù
    elif -1.45 < y < -.55 and z > 1.55:
        flow, L = V((x * .3, .35, -1)), .24          # yếm ngực
    elif y > 1.85 and z > 2.1:
        i = min(range(len(TAIL) - 1), key=lambda k: (p - TAIL[k].lerp(TAIL[k + 1], .5)).length)
        flow, L, lift = TAIL[i + 1] - TAIL[i], .27, .5
    elif z < 1.5 and not (-.5 < y < .65 and z > 1.15):
        flow, L = V((0, 0, -1)), .09
        if z < .4:
            flow, L = V((0, -1, -.25)), .032
    elif z < 1.55:
        L = .2
    return L, lift, flow


uvl = body.data.uv_layers['UVMap'].data
body.data.calc_loop_triangles()
tris = body.data.loop_triangles
cum, acc = [], 0.0
for t in tris:
    dens = 1.0
    c = t.center
    if c.y < -1.3 and c.z > 2.6:
        dens = 2.6                                   # mặt cần lông mịn, dày
    elif c.z < .55:
        dens = 1.8
    acc += t.area * dens
    cum.append(acc)
N = 150000
strands = []
for t in random.choices(tris, cum_weights=cum, k=N):
    a, b = random.random(), random.random()
    if a + b > 1:
        a, b = 1 - a, 1 - b
    w = (1 - a - b, a, b)
    vs = [body.data.vertices[i] for i in t.vertices]
    p = sum((v.co * k for v, k in zip(vs, w)), V((0, 0, 0)))
    nrm = sum((v.normal * k for v, k in zip(vs, w)), V((0, 0, 0))).normalized()
    if any(V((p.x - c.x, (p.z - c.z))).length < EYE_R * 1.07 and p.y < c.y + .08 for c in EYES.values()):
        continue
    if (p - NOSE).length < .11:
        continue
    cc = coat_color(p)
    k = random.uniform(.88, 1.15)
    cc = tuple(min(1, v * k) for v in cc)
    uv = sum((uvl[li].uv * k2 for li, k2 in zip(t.loops, w)), V((0, 0)))
    L, lift, flow = fur_params(p)
    if any((p - c).length < EYE_R * 1.7 for c in EYES.values()):
        L = min(L, .045)
    strands.append((strand(p, nrm, flow, L, lift), cc, tuple(uv), .0036))
fur = make_curves('Long_Than', strands)
fur.data.surface = body
fur.data.surface_uv_map = 'UVMap'
fur.parent = body
body.add_rest_position_attribute = True
ng = bpy.data.node_groups.new('Long_bam_da', 'GeometryNodeTree')
ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
gi, go = ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
df = ng.nodes.new('GeometryNodeDeformCurvesOnSurface')
ng.links.new(gi.outputs[0], df.inputs[0])
ng.links.new(df.outputs[0], go.inputs[0])
fur.modifiers.new('bam_da', 'NODES').node_group = ng
print('STRANDS', len(strands))

by_bone = {}
for p, n, cc, L, flow, bname in ear_fur:
    by_bone.setdefault(bname, []).append((strand(p, n, flow, L, .3), cc, None, .0028))
for bname, st in by_bone.items():
    bone_parent(make_curves('Long_' + bname, st), bname)

# ───────────────────────── 5. CHUYỂN ĐỘNG: đi bộ tại chỗ, lặp 96 khung ─────────────────────────
pb = rig.pose.bones
for b in pb:
    b.rotation_mode = 'QUATERNION'
CYCLE, END, DUTY, STRIDE = 48, 96, .66, .52
scene.frame_start, scene.frame_end, scene.render.fps = 1, END, 24


def set_rot(name, axis, ang, f, extra=None):
    R = arm.bones[name].matrix_local.to_quaternion()
    q = Quaternion(V(axis), ang)
    if extra:
        q = Quaternion(V(extra[0]), extra[1]) @ q
    pb[name].rotation_quaternion = R.inverted() @ q @ R
    pb[name].keyframe_insert('rotation_quaternion', frame=f)


def set_loc(name, delta, f):
    pb[name].location = arm.bones[name].matrix_local.to_3x3().inverted() @ V(delta)
    pb[name].keyframe_insert('location', frame=f)


# thứ tự bước của mèo: sau trái → trước trái → sau phải → trước phải
PHASE = {'ik_hind.L': 0.0, 'ik_front.L': .25, 'ik_hind.R': .5, 'ik_front.R': .75}


def blink_amount(f):
    return max(0, 1 - abs(f - c) / 4) if abs(f - (c := min((30, 36, 82), key=lambda k: abs(f - k)))) < 4 else 0


for f in range(1, END + 2):
    u = ((f - 1) % CYCLE) / CYCLE
    w = 2 * math.pi * u
    for name, ph in PHASE.items():
        for sn in (name[-1],):
            t = (u - ph) % 1
            if t < DUTY:                      # chân trụ: trượt đều ra sau
                k = t / DUTY
                dy, dz, tilt = -STRIDE / 2 + STRIDE * k, 0, 0
            else:                             # chân đưa lên phía trước
                k = (t - DUTY) / (1 - DUTY)
                e = .5 - .5 * math.cos(math.pi * k)
                dy = STRIDE / 2 - STRIDE * e
                dz = math.sin(math.pi * k) * .27
                tilt = math.sin(math.pi * k) * (.85 if 'front' in name else .45)
            set_loc(name, (0, dy, dz), f)
            set_rot(name, (1, 0, 0), tilt, f)
    set_loc('hips', (math.sin(w) * .035, 0, -.07 + math.cos(w * 2) * .028), f)
    set_rot('hips', (0, 0, 1), math.sin(w) * .05, f, ((0, 1, 0), math.sin(w) * .035))
    set_rot('spine', (0, 0, 1), -math.sin(w) * .045, f)
    set_rot('chest', (0, 0, 1), -math.sin(w) * .05, f, ((0, 1, 0), -math.sin(w) * .03))
    set_rot('neck', (1, 0, 0), math.cos(w * 2 + .6) * .03, f)
    look = math.sin(2 * math.pi * (f - 1) / END)
    set_rot('head', (0, 0, 1), look * .16, f, ((0, 1, 0), look * .06))
    for sn in 'LR':
        set_rot('scapula.' + sn, (1, 0, 0), math.sin(w - (0 if sn == 'L' else math.pi) - 1.5) * .07, f)
        bl = blink_amount(f)
        set_rot('eyelid.' + sn, (1, 0, 0), bl * LID_CLOSE, f)
    tw = math.sin((f - 55) / 8 * math.pi) if 55 <= f <= 63 else 0
    set_rot('ear.L', (0, 1, 0), tw * .28, f)
    set_rot('ear.R', (0, 1, 0), -math.sin(2 * w) * .025, f)
    for i, n in enumerate(tail_names):
        set_rot(n, (0, 1, 0), math.sin(w - i * .45) * .055, f, ((1, 0, 0), math.sin(w * 2 - i * .5) * .018))

# ───────────────────────── 6. SÂN KHẤU ─────────────────────────
floor_m = material('San', lin(196, 205, 212), rough=.9)
# phông cong liền sàn, đối diện camera chính, không lộ chân trời
prof = [(-40, .015), (0, .015), (9, .015)]
prof += [(9 + 6 * math.sin(i / 16 * math.pi / 2), .015 + 6 * (1 - math.cos(i / 16 * math.pi / 2))) for i in range(1, 17)]
prof.append((15, 40))
R_bg = Matrix.Rotation(math.radians(-38), 3, 'Z')
mesh_obj('San', [R_bg @ V((x, y, z)) for y, z in prof for x in (-60, 60)],
         [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(prof) - 1)], floor_m)
wd = bpy.data.worlds.new('w')
scene.world = wd
wd.use_nodes = True
bg = wd.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (.55, .62, .72, 1)
bg.inputs['Strength'].default_value = .55


def area(name, loc, energy, size, color):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy, l.size, l.color = energy, size, color
    o = link(bpy.data.objects.new(name, l))
    o.location = loc
    o.rotation_euler = (V((0, 0, 2)) - V(loc)).to_track_quat('-Z', 'Y').to_euler()


area('Chinh', (-5, -7, 8), 800, 4, (1, .93, .84))
area('Phu', (7, -3, 3), 220, 5, (.82, .89, 1))
area('Ven', (2, 7, 6), 650, 3, (1, .95, .9))


def camera(name, loc, aim, lens):
    c = bpy.data.cameras.new(name)
    c.lens = lens
    o = link(bpy.data.objects.new(name, c))
    o.location = loc
    o.rotation_euler = (V(aim) - V(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


cams = {'toan_than': camera('Cam_ToanThan', (-7.6, -9.4, 4.3), (0, .35, 2.15), 68),
        'mat': camera('Cam_Mat', (-1.5, -7.2, 3.45), (0, -1.6, 3.16), 105),
        'canh_ben': camera('Cam_CanhBen', (-14, .4, 2.6), (0, .45, 2.15), 75)}
scene.camera = cams['toan_than']
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.cycles_curves.shape = 'RIBBONS'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU', e)
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'meo.blend'))
print('SAVED')
