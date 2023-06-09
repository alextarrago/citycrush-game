import Piece from './Piece'
import Map, { map } from './Map'
import { average, convertPositionToTile, convertTileToPosition, getPieceHashColor, getRandomValueFromArray, isNumberInsideBoard, makeMovementAnimation, makeScaleAnimation, recognizeScoreType, rndNumber, timeout } from '../Utils/utils';
import { gameScene, levelBarImg, scoreText, levelText, timerText } from '../Scenes/GameScene';
import { PositionInPixel, PositionInTile, ScoreTypes, TileNumbers } from '../game.interfaces';
import { HALF_SCREEN, INITIAL_BOARD_SCREEN, LEVEL_SCORE_TO_ADD, PIECE_TYPES, TILE } from '../Utils/gameValues';
//import * as gv from '../Utils/gameValues';
// eslint-disable-next-line import/prefer-default-export
export let gameManager: GameManager

export default class GameManager {
    public map: Map;
    lastPiece: Piece;
    currentPiece: Piece;
    score: number;
    level: number;
    scoreObjective: number;
    previousScoreObjective: number;
    isPieceSelectedInFrame = false;
    isMoving = false;
    timeInterval: any;

    constructor() {
        gameManager = this;
        this.clearInterval();
        this.start();


    }

    private start() {
        this.resetScoreAndLevel();
        this.map = new Map();
        this.startTimer();
    }

    public resetScoreAndLevel() {
        this.level = 1;
        this.scoreObjective = this.level * LEVEL_SCORE_TO_ADD;
        this.previousScoreObjective = 0;
        this.score = 0;
        levelBarImg.scaleX = 0;
        scoreText.setText(`Punts: ${this.score}`);
    }

    public reset() {
        map.resetMap();
        this.resetScoreAndLevel();
        this.clearInterval();

        this.startTimer();
    }

    public changeCurrentSelectedPiece(newPiece: Piece): Piece {
        if (this.currentPiece) {
            this.lastPiece = this.currentPiece;
            this.lastPiece.clearFrame();
        }
        this.currentPiece = newPiece;
        this.isPieceSelectedInFrame = true;
        return this.currentPiece;
    }

    public resetPiecesForAction() {
        this.lastPiece = this.currentPiece;
        this.currentPiece = null;
        this.lastPiece.clearFrame();
        this.isPieceSelectedInFrame = false;
    }

    private async scoreAndLevelUp(pieces: Piece[]) {
        const scoreType = recognizeScoreType(pieces);
        await this.scoreIt(scoreType, pieces);
        if (this.score >= this.scoreObjective) this.levelUp();
    }

    private levelUp() {
        gameScene.sound.play('levelUpSound');
        this.level++;
        levelText.setText(`Nivell: ${this.level}`);
        levelBarImg.scaleX = 0;
        this.previousScoreObjective = this.scoreObjective;
        this.scoreObjective = this.level * LEVEL_SCORE_TO_ADD + (this.level * 100);
    }

    private insertModalText(text: string | number, { x, y }: PositionInPixel, type = 'normal', color = '#ffffff') {
        const levelText = gameScene.add.text(x, y, text.toString(), {
            font: 'bold 63px Geneva',
            stroke: '#000000',
            strokeThickness: 10,
            color
        }).setDepth(1.1).setOrigin(0.5, 0.5);
        makeMovementAnimation(levelText, { x: levelText.x, y: levelText.y - 250 }, 600);

        gameScene.tweens.add({
            targets: levelText,
            alpha: 0,
            duration: 1000,
            ease: 'Power2'
        });
    }

    private async scoreIt(scoreToType: ScoreTypes, pieces: Piece[]) {
        let toScore = 100;
        switch (scoreToType) {
            case '3line':
                toScore = 50;
                break;
            case '4line':
                toScore = 100;
                break;
            case '5line':
                toScore = 500;
                break;
            case '6line':
                toScore = 800;
                break;
            case '3L':
                toScore = 800;
                break;
            case '4L':
                toScore = 1000;
                break;
            default:
                console.log('No scoreType was found');
        }

        this.calculateScoreUI(pieces, toScore);
        this.score += toScore;
        await this.updateLevelBar();

        scoreText.setText(`Punts: ${this.score}`);
    }

    calculateScoreUI(pieces: Piece[], score) {
        const arrayXValues = [];
        const arrayYValues = [];
        pieces.forEach((piece) => {
            arrayXValues.push(piece.currentTile.tileX);
            arrayYValues.push(piece.currentTile.tileY);
        });
        const tileX = average(arrayXValues) as TileNumbers;
        const tileY = average(arrayYValues) as TileNumbers;
        const color = getPieceHashColor(pieces[0]);
        this.insertModalText(score, convertTileToPosition({ tileX, tileY }), 'score', color);
    }

    private async updateLevelBar() {
        return new Promise<void>((resolve) => {
            const newScaleXVal = (this.score - this.previousScoreObjective) / (LEVEL_SCORE_TO_ADD + (this.level > 1 ? this.level * 100 : 0));
            gameScene.tweens.add({
                targets: levelBarImg,
                scaleX: newScaleXVal,
                ease: 'Linear',
                duration: 500,
                onComplete() {
                    resolve();
                }
            });
        });
    }

    private playExplodingBubbleSound() {
        gameScene.sound.play(`bubble${rndNumber(1, 3, true)}`);
        setTimeout(() => {
            gameScene.sound.play(`bubble${rndNumber(1, 3, true)}`);
        }, 150);
    }

    public async makeTwoPieceAnimation(currentPiece: Piece, lastPiece: Piece): Promise<null> {
        makeMovementAnimation(lastPiece, {
            x: currentPiece.currentPosition.x,
            y: currentPiece.currentPosition.y
        }, 300);
        await makeMovementAnimation(currentPiece, {
            x: lastPiece.currentPosition.x,
            y: lastPiece.currentPosition.y
        }, 300);

        return null;
    }

    public async piecesMovement(pieceToSwitch: Piece) {
        if (this.isPieceSelectedInFrame && map.isPieceAdjacent(pieceToSwitch)) {
            this.isMoving = true;
            this.resetPiecesForAction();
            await pieceToSwitch.switch(this.lastPiece);
            const { matchArrOfPieces, finalMap } = map.checkMatch(map.getCurrentMap(), this.lastPiece);
            if (finalMap && finalMap.length > 0) map.setCurrentMap(finalMap);

            let opositePieceMatchArr = [];
            const opositePieceResponse = map.checkMatch(map.getCurrentMap(), pieceToSwitch);
            if (opositePieceResponse.finalMap && opositePieceResponse.finalMap.length > 0) {
                map.setCurrentMap(opositePieceResponse.finalMap);
                opositePieceMatchArr = opositePieceResponse.matchArrOfPieces;
            }

            if (matchArrOfPieces.length >= 3) {
                await this.matchIt(matchArrOfPieces);
            }
            if (opositePieceMatchArr.length >= 3) {
                await this.matchIt(opositePieceMatchArr);
            }

            if (opositePieceMatchArr.length <= 0 && matchArrOfPieces.length <= 0) {
                await pieceToSwitch.switch(this.lastPiece);
            }

            let resultForGameOver = map.isBoardMatch(map.getCurrentMap());

            const resultForFutureMoves = map.isExistantFutureMoves(map.getCurrentMap());
            if (!resultForGameOver.isMatch && !resultForFutureMoves) {
                this.gameOver();
            }

            if (resultForGameOver.isMatch) {
                do {
                    await this.matchAgain(resultForGameOver.piece);
                    resultForGameOver = map.isBoardMatch(map.getCurrentMap());
                } while (resultForGameOver.isMatch);

                if (!map.isExistantFutureMoves(map.getCurrentMap())) this.gameOver();
            }

            this.isMoving = false;
            return true;
        }
        return false;
    }

    private async matchAgain(piece: Piece) {
        const { matchArrOfPieces, finalMap } = map.checkMatch(map.getCurrentMap(), piece);
        await this.matchIt(matchArrOfPieces);
    }

    public gameOver() {
        // let scoreMenu = gameScene.add.image(INITIAL_BOARD_SCREEN.WIDTH - TILE.WIDTH / 2 - 20, 500, 'ScoreMenu').setDepth(1).setOrigin(0, 0);
        // let buttonMenu = gameScene.add.image(scoreMenu.x + (scoreMenu.width / 2) - 188, scoreMenu.y + 250, 'RestartButton').setDepth(1).setOrigin(0, 0);
        // buttonMenu.setInteractive({ useHandCursor: true });
        // buttonMenu.on('pointerup', () => gameScene.start('MenuScene'));

        // buttonMenu.on('pointerup', () => {
        //     buttonMenu.destroy();
        //     scoreMenu.destroy();
        //     this.reset();
        // });
    }

    private matchIt = async (pieces: Piece[]): Promise<null> => {
        this.playExplodingBubbleSound();
        await makeScaleAnimation(pieces);
        pieces.forEach((piece) => piece.destroy());
        this.scoreAndLevelUp(pieces);
        this.fallPieces(pieces);
        this.generateMore();
        await timeout(500);
        return null;
    }

    private async fallPieces(piecesThatMatch: Piece[]) {
        let newPiecesThatMatch = piecesThatMatch.map((piece) => piece.currentTile);
        let currentMatchArr;

        newPiecesThatMatch.sort((a, b) => a.tileY - b.tileY);
        do {
            currentMatchArr = [];
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            newPiecesThatMatch.forEach(async ({ tileX, tileY }) => {
                let contador = 0;
                const currentMap = map.getCurrentMap();

                if (isNumberInsideBoard(tileY - contador)) {
                    do {
                        contador++;
                    } while (isNumberInsideBoard(tileY - contador) && !currentMap[tileX][tileY - contador]);

                    const pieceToReplace = currentMap[tileX][tileY - contador];
                    if (pieceToReplace) {
                        pieceToReplace.updatePiecePositionAndTile({ tileX, tileY });
                        makeMovementAnimation(pieceToReplace, convertTileToPosition({ tileX, tileY }), 200);

                        map.setPieceOnTile(null, { tileX, tileY: (tileY - contador) as TileNumbers });
                        currentMatchArr.push({ tileX, tileY: (tileY - contador) as TileNumbers });
                    }
                }
                newPiecesThatMatch = currentMatchArr.sort((a, b) => a.tileY - b.tileY);
            });
        } while (currentMatchArr.length > 0);
    }

    private async generateMore() {
        const currentMap = map.getCurrentMap();
        const emptyTiles: PositionInTile[] = [];
        currentMap.forEach((line, tileX: TileNumbers) => line.forEach((piece, tileY: TileNumbers) => {
            if (!piece || !piece.active) emptyTiles.push({ tileX, tileY });
        }));

        emptyTiles.sort((a, b) => b.tileY - a.tileY);

        let contador = 1;
        let xValue: number;
        emptyTiles.forEach((tilePosition: PositionInTile) => {
            const pieceTypeLetter = getRandomValueFromArray(PIECE_TYPES);
            const newTilePosition = convertTileToPosition(tilePosition);
            if (xValue !== tilePosition.tileX) contador = 1;
            else {
                contador++;
            }
            xValue = tilePosition.tileX;
            const yPositon = (INITIAL_BOARD_SCREEN.HEIGHT - (TILE.HEIGHT * contador));
            const newPosition = { x: newTilePosition.x, y: yPositon };
            const piece = new Piece(pieceTypeLetter, newPosition);

            piece.updatePiecePositionAndTile(tilePosition);
            makeMovementAnimation(piece, convertTileToPosition(tilePosition), 200);
        });
    }

    public clearInterval() {
        clearInterval(this.timeInterval);
    }
    public startTimer() {
        let timerValue = 120 * 1000;

        function timerTick() {
            timerValue -= 10;

            if (timerValue < 0) {
                clearInterval(this.timeInterval);
                let scoreMenu = gameScene.add.image(INITIAL_BOARD_SCREEN.WIDTH - TILE.WIDTH / 2 - 20, 500, 'ScoreMenu').setDepth(1).setOrigin(0, 0);
                let buttonMenu = gameScene.add.image(scoreMenu.x + (scoreMenu.width / 2) - 188, scoreMenu.y + 250, 'RestartButton').setDepth(1).setOrigin(0, 0);
                buttonMenu.setInteractive({ useHandCursor: true });

                buttonMenu.on('pointerup', () => {
                    buttonMenu.destroy();
                    scoreMenu.destroy();
                    this.reset();
                });
                return;
            }
            const totalSeconds = Math.floor(timerValue / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const remainingSeconds = totalSeconds % 60;
            const remainingMilliseconds = timerValue % 1000;

            const formattedMinutes = String(minutes).padStart(2, '0');
            const formattedSeconds = String(remainingSeconds).padStart(2, '0');
            const formattedMilliseconds = String(remainingMilliseconds).padStart(3, '0');

            const formattedTime = `${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
            timerText.setText(`Temps: ${formattedTime}`);
        }

        this.timeInterval = setInterval(timerTick, 10);
    }

}
