// PONG, written in CHIP-8 assembly and assembled at require-time.
// Register map:
//   V1 left paddle Y     V2 right paddle Y
//   V3 ball X            V4 ball Y
//   V5 ball dX (1/255)   V6 ball dY (1/255)
//   V7 left score        V8 right score
//   V0 key scratch       VA/VB/VC scratch
// Keys: 1 = left up, 4 = left down, C = right up, D = right down.
// First to 7 jumps to game_over and halts; the host reads V7/V8.

const { assemble } = require('./chip8');

const SOURCE = `
start:
    CLS
    LD V1, 13
    LD V2, 13
    LD V7, 0
    LD V8, 0
    CALL draw_left_score
    CALL draw_right_score
    CALL serve_right
    CALL draw_left
    CALL draw_right
    CALL draw_ball

frame:
    LD VC, 2
    LD DT, VC

    LD V0, 1                ; left paddle keys
    SKNP V0
    CALL left_up
    LD V0, 4
    SKNP V0
    CALL left_down

    LD V0, 12               ; right paddle keys
    SKNP V0
    CALL right_up
    LD V0, 13
    SKNP V0
    CALL right_down

    CALL draw_ball          ; erase (XOR) at old position
    ADD V3, V5
    ADD V4, V6

    SNE V4, 0               ; bounce off top and bottom
    CALL flip_dy
    SNE V4, 31
    CALL flip_dy

    SNE V3, 3               ; paddle planes
    CALL check_left_hit
    SNE V3, 60
    CALL check_right_hit

    SNE V3, 0               ; goals
    JP right_scores
    SNE V3, 63
    JP left_scores

resume:
    CALL draw_ball          ; draw at new position

wait:
    LD V0, DT
    SE V0, 0
    JP wait
    JP frame

left_up:
    SNE V1, 0
    RET
    CALL draw_left
    ADD V1, 255
    CALL draw_left
    RET
left_down:
    SNE V1, 27
    RET
    CALL draw_left
    ADD V1, 1
    CALL draw_left
    RET
right_up:
    SNE V2, 0
    RET
    CALL draw_right
    ADD V2, 255
    CALL draw_right
    RET
right_down:
    SNE V2, 27
    RET
    CALL draw_right
    ADD V2, 1
    CALL draw_right
    RET

flip_dy:
    LD VA, 0
    SUBN V6, VA             ; V6 = 0 - V6
    RET

check_left_hit:
    LD VA, V4
    SUB VA, V1              ; VF = 1 when ballY >= paddleY
    SE VF, 1
    RET
    LD VB, 5
    SUB VA, VB              ; VF = 0 when (ballY - paddleY) < 5
    SE VF, 0
    RET
    LD V5, 1
    LD VC, 2
    LD ST, VC
    RET

check_right_hit:
    LD VA, V4
    SUB VA, V2
    SE VF, 1
    RET
    LD VB, 5
    SUB VA, VB
    SE VF, 0
    RET
    LD V5, 255
    LD VC, 2
    LD ST, VC
    RET

right_scores:
    CALL draw_right_score   ; erase old digit
    ADD V8, 1
    CALL draw_right_score
    LD VC, 4
    LD ST, VC
    SNE V8, 7
    JP game_over
    CALL serve_left
    JP resume

left_scores:
    CALL draw_left_score
    ADD V7, 1
    CALL draw_left_score
    LD VC, 4
    LD ST, VC
    SNE V7, 7
    JP game_over
    CALL serve_right
    JP resume

game_over:
    JP game_over

serve_left:
    LD V3, 31
    RND V4, 15
    ADD V4, 8
    LD V5, 255
    CALL rand_dy
    RET
serve_right:
    LD V3, 31
    RND V4, 15
    ADD V4, 8
    LD V5, 1
    CALL rand_dy
    RET
rand_dy:
    RND V6, 1
    SNE V6, 0
    LD V6, 255
    RET

draw_left:
    LD I, paddle_sprite
    LD VA, 2
    DRW VA, V1, 5
    RET
draw_right:
    LD I, paddle_sprite
    LD VA, 61
    DRW VA, V2, 5
    RET
draw_ball:
    LD I, ball_sprite
    DRW V3, V4, 1
    RET
draw_left_score:
    LD F, V7
    LD VA, 26
    LD VB, 1
    DRW VA, VB, 5
    RET
draw_right_score:
    LD F, V8
    LD VA, 34
    LD VB, 1
    DRW VA, VB, 5
    RET

paddle_sprite:
    DB 0x80, 0x80, 0x80, 0x80, 0x80
ball_sprite:
    DB 0x80
`;

const { bytes, labels } = assemble(SOURCE);

module.exports = { SOURCE, bytes, labels };
