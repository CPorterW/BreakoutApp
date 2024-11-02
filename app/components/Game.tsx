import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, PanResponderInstance } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import Peer, { DataConnection } from 'peerjs';

// Constants based on viewport like the original
const window = Dimensions.get('window');
const CANVAS_WIDTH = window.width * 0.6;
const CANVAS_HEIGHT = CANVAS_WIDTH * 2/3;
const BALL_RADIUS = CANVAS_WIDTH / 48;
const PADDLE_WIDTH = BALL_RADIUS * 5;
const PADDLE_HEIGHT = BALL_RADIUS;
const INITIAL_SPEED = CANVAS_WIDTH / 240;

// Interfaces
interface GameState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  paddleX: number;
  paddleY: number;
  score: number;
  highScore: number;
  isGameOver: boolean;
}

interface Brick {
  brickX: number;
  brickY: number;
  width: number;
  height: number;
  hasBeenHit: boolean;
}

const Game: React.FC = () => {
  // State management
  const [gameState, setGameState] = useState<GameState>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT * 27/32,
    dx: INITIAL_SPEED,
    dy: CANVAS_HEIGHT / -160,
    speed: INITIAL_SPEED,
    paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    paddleY: CANVAS_HEIGHT * 30/32 - BALL_RADIUS,
    score: 0,
    highScore: 0,
    isGameOver: false,
  });

  const [bricks, setBricks] = useState<Brick[]>([]);
  const [brickNumPerRow, setBrickNumPerRow] = useState(6);
  const [brickColNum] = useState(3);
  
  const gameLoop = useRef<NodeJS.Timer | null>(null);

  const generateBrickField = () => {
    const gapsBetweenBricks = brickNumPerRow + 1;
    const brickWidth = CANVAS_WIDTH/48 * (48-gapsBetweenBricks)/brickNumPerRow;
    const brickHeight = CANVAS_WIDTH/48 * 2;
    const gap = CANVAS_WIDTH/48;
    
    let brickX = gap;
    let brickY = gap;
    const newBricks: Brick[] = [];

    for (let i = 0; i < brickNumPerRow * brickColNum; i++) {
      if (i % brickNumPerRow === 0 && i !== 0) {
        brickY += brickHeight + gap;
        brickX = gap;
      }

      newBricks.push({
        brickX,
        brickY,
        width: brickWidth,
        height: brickHeight,
        hasBeenHit: false
      });

      brickX += brickWidth + gap;
    }
    setBricks(newBricks);
  };

  const whetherBallDirectionShouldSwitch = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    objLeftX: number,
    objRightX: number,
    objTopY: number,
    objBottomY: number,
    brickId: number = -1
  ): [number, number, number, number] => {
    const leftBound = objLeftX - BALL_RADIUS;
    const rightBound = objRightX + BALL_RADIUS;
    const topBound = objTopY - BALL_RADIUS;
    const bottomBound = objBottomY + BALL_RADIUS;

    if (x > leftBound && x < rightBound && y > topBound && y < bottomBound) {
      const overlapLeft = x - leftBound;
      const overlapRight = rightBound - x;
      const overlapTop = y - topBound;
      const overlapBottom = bottomBound - y;

      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft) {
        x = leftBound;
        dx = -Math.abs(dx);
      } else if (minOverlap === overlapRight) {
        x = rightBound;
        dx = Math.abs(dx);
      } else if (minOverlap === overlapTop) {
        y = topBound;
        dy = -Math.abs(dy);
      } else if (minOverlap === overlapBottom) {
        y = bottomBound;
        dy = Math.abs(dy);
      }

      dx += (Math.random() - 0.5) * gameState.speed/8;
      dy += (Math.random() - 0.5) * gameState.speed/8;

      dx = Math.sign(dx) * Math.abs(dx/dy * gameState.speed);
      dy = Math.sign(dy) * Math.abs(dy/dx * gameState.speed);

      if (Math.abs(dx) < gameState.speed/1.3) {
        dx = Math.sign(dx) * gameState.speed;
        dy = Math.sign(dy) * gameState.speed;
      }
      if (Math.abs(dy) < gameState.speed/1.3) {
        dx = Math.sign(dx) * gameState.speed;
        dy = Math.sign(dy) * gameState.speed;
      }

      if (brickId !== -1) {
        const newBricks = [...bricks];
        newBricks[brickId].hasBeenHit = true;
        setBricks(newBricks);
        setGameState(prev => ({
          ...prev,
          score: prev.score + 1,
          highScore: Math.max(prev.score + 1, prev.highScore)
        }));

        // Check if all bricks are cleared
        const bricksNotCleared = newBricks.filter(brick => !brick.hasBeenHit).length;
        if (bricksNotCleared === 0) {
          setBrickNumPerRow(prev => prev + 1);
          setTimeout(generateBrickField, 0); // Ensure state updates before regenerating
        }
      }
    }

    return [x, y, dx, dy];
  };

  const panResponder: PanResponderInstance = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      let newX = gestureState.moveX - PADDLE_WIDTH / 2;
      newX = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, newX));
      setGameState(prev => ({ ...prev, paddleX: newX }));
    },
  });

  const updateGame = () => {
    setGameState(prev => {
      let { x, y, dx, dy, paddleX, paddleY, score, highScore, speed } = prev;

      // Wall collisions
      if (x + dx > CANVAS_WIDTH - BALL_RADIUS || x + dx < BALL_RADIUS) {
        dx = -dx;
      }
      if (y + dy < BALL_RADIUS) {
        dy = -dy;
      }

      // Paddle collision
      [x, y, dx, dy] = whetherBallDirectionShouldSwitch(
        x, y, dx, dy,
        paddleX,
        paddleX + PADDLE_WIDTH,
        paddleY,
        paddleY + PADDLE_HEIGHT
      );

      // Brick collisions - Check BEFORE moving the ball
      bricks.forEach((brick, index) => {
        if (!brick.hasBeenHit) {
          [x, y, dx, dy] = whetherBallDirectionShouldSwitch(
            x, y, dx, dy,
            brick.brickX,
            brick.brickX + brick.width,
            brick.brickY,
            brick.brickY + brick.height,
            index
          );
        }
      });

      // Move ball
      x += dx;
      y += dy;

      // Check game over
      if (y > CANVAS_HEIGHT - BALL_RADIUS) {
        return {
          ...prev,
          isGameOver: true
        };
      }

      return { ...prev, x, y, dx, dy };
    });
  };

  const restartGame = () => {
    setGameState({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT * 27/32,
      dx: INITIAL_SPEED,
      dy: CANVAS_HEIGHT / -160,
      speed: INITIAL_SPEED,
      paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
      paddleY: CANVAS_HEIGHT * 30/32 - BALL_RADIUS,
      score: 0,
      highScore: gameState.highScore,
      isGameOver: false,
    });
    setBrickNumPerRow(6);
    generateBrickField();
  };

  // Initialize game
  useEffect(() => {
    generateBrickField();
    gameLoop.current = setInterval(updateGame, 10);

    return () => {
      if (gameLoop.current) {
        clearInterval(gameLoop.current as unknown as number);
      }
    };
  }, []);

  // Regenerate brick field when brickNumPerRow changes
  useEffect(() => {
    generateBrickField();
  }, [brickNumPerRow]);

  return (
    <View style={styles.container}>
      <Text style={styles.score}>Score: {gameState.score}</Text>
      <Text style={styles.score}>High Score: {gameState.highScore}</Text>

      <View {...panResponder.panHandlers}>
        <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={styles.canvas}>
          {/* Ball */}
          <Circle
            cx={gameState.x}
            cy={gameState.y}
            r={BALL_RADIUS}
            fill="#2F2219"
          />
          
          {/* Paddle */}
          <Rect
            x={gameState.paddleX}
            y={gameState.paddleY}
            width={PADDLE_WIDTH}
            height={PADDLE_HEIGHT}
            fill="#2F2219"
          />
          
          {/* Bricks */}
          {bricks.map((brick, index) => (
            !brick.hasBeenHit && (
              <Rect
                key={index}
                x={brick.brickX}
                y={brick.brickY}
                width={brick.width}
                height={brick.height}
                fill="#2F2219"
              />
            )
          ))}
        </Svg>
      </View>

      {gameState.isGameOver && (
        <Text style={styles.gameOver} onPress={restartGame}>
          Game Over - Tap to Restart
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    backgroundColor: '#f0f0f0',
  },
  score: {
    fontSize: 16,
    marginBottom: 5,
  },
  gameOver: {
    position: 'absolute',
    fontSize: 24,
    color: 'red',
    textAlign: 'center',
  },
});

export default Game;