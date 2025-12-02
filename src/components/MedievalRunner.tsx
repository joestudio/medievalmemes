import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

interface GameState {
  score: number;
  isPlaying: boolean;
  isGameOver: boolean;
  highScore: number;
}

const MedievalRunner = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    isPlaying: false,
    isGameOver: false,
    highScore: 0,
  });
  
  const gameRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    player: THREE.Mesh;
    obstacles: THREE.Mesh[];
    gems: THREE.Mesh[];
    isJumping: boolean;
    jumpVelocity: number;
    speed: number;
    animationId: number;
    score: number;
  } | null>(null);

  const initGame = useCallback(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1510);
    scene.fog = new THREE.Fog(0x1a1510, 10, 50);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 1, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Lighting - Torchlight ambiance
    const ambientLight = new THREE.AmbientLight(0x3d2817, 0.4);
    scene.add(ambientLight);

    const torchLight1 = new THREE.PointLight(0xff8c42, 1.5, 20);
    torchLight1.position.set(-3, 4, 0);
    torchLight1.castShadow = true;
    scene.add(torchLight1);

    const torchLight2 = new THREE.PointLight(0xff6b35, 1.5, 20);
    torchLight2.position.set(3, 4, 0);
    torchLight2.castShadow = true;
    scene.add(torchLight2);

    const frontLight = new THREE.DirectionalLight(0xffd4a3, 0.5);
    frontLight.position.set(0, 10, 10);
    scene.add(frontLight);

    // Ground - Stone floor
    const groundGeometry = new THREE.PlaneGeometry(8, 100, 8, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4035,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stone pattern on ground
    for (let i = 0; i < 50; i++) {
      const lineGeometry = new THREE.PlaneGeometry(8, 0.05);
      const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x3a3025 });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.01;
      line.position.z = -i * 2;
      scene.add(line);
    }

    // Walls
    const wallGeometry = new THREE.BoxGeometry(0.5, 6, 100);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d3428,
      roughness: 0.95,
    });

    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-4, 3, -25);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(4, 3, -25);
    scene.add(rightWall);

    // Player - Knight-like block
    const playerGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.8);
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a959,
      metalness: 0.6,
      roughness: 0.4,
    });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 0.6, 5);
    player.castShadow = true;
    scene.add(player);

    // Player helmet detail
    const helmetGeometry = new THREE.ConeGeometry(0.3, 0.4, 4);
    const helmetMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.7,
      roughness: 0.3,
    });
    const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
    helmet.position.y = 0.8;
    player.add(helmet);

    gameRef.current = {
      scene,
      camera,
      renderer,
      player,
      obstacles: [],
      gems: [],
      isJumping: false,
      jumpVelocity: 0,
      speed: 0.15,
      animationId: 0,
      score: 0,
    };

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !gameRef.current) return;
      const { camera, renderer } = gameRef.current;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  const createObstacle = useCallback(() => {
    if (!gameRef.current) return;

    const { scene, obstacles } = gameRef.current;
    
    const geometry = new THREE.BoxGeometry(
      1 + Math.random() * 1.5,
      0.8 + Math.random() * 0.8,
      1
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0x5a4a3a,
      roughness: 0.95,
    });
    const obstacle = new THREE.Mesh(geometry, material);
    
    const lanes = [-2, 0, 2];
    obstacle.position.set(
      lanes[Math.floor(Math.random() * lanes.length)],
      geometry.parameters.height / 2,
      -40
    );
    obstacle.castShadow = true;
    
    scene.add(obstacle);
    obstacles.push(obstacle);
  }, []);

  const createGem = useCallback(() => {
    if (!gameRef.current) return;

    const { scene, gems } = gameRef.current;
    
    // Octahedron for gem shape
    const geometry = new THREE.OctahedronGeometry(0.3);
    const colors = [0x50c878, 0xe0115f, 0x0f52ba]; // Emerald, Ruby, Sapphire
    const material = new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      metalness: 0.8,
      roughness: 0.2,
      emissive: colors[Math.floor(Math.random() * colors.length)],
      emissiveIntensity: 0.3,
    });
    const gem = new THREE.Mesh(geometry, material);
    
    const lanes = [-2, 0, 2];
    gem.position.set(
      lanes[Math.floor(Math.random() * lanes.length)],
      1.5,
      -40
    );
    
    scene.add(gem);
    gems.push(gem);
  }, []);

  const jump = useCallback(() => {
    if (!gameRef.current || gameRef.current.isJumping) return;
    gameRef.current.isJumping = true;
    gameRef.current.jumpVelocity = 0.25;
  }, []);

  const startGame = useCallback(() => {
    if (!gameRef.current) {
      initGame();
    }
    
    // Reset game state
    if (gameRef.current) {
      gameRef.current.obstacles.forEach(o => gameRef.current!.scene.remove(o));
      gameRef.current.gems.forEach(g => gameRef.current!.scene.remove(g));
      gameRef.current.obstacles = [];
      gameRef.current.gems = [];
      gameRef.current.player.position.set(0, 0.6, 5);
      gameRef.current.speed = 0.15;
      gameRef.current.score = 0;
    }
    
    setGameState(prev => ({
      ...prev,
      score: 0,
      isPlaying: true,
      isGameOver: false,
    }));
  }, [initGame]);

  const gameLoop = useCallback(() => {
    if (!gameRef.current || !gameState.isPlaying) return;

    const { scene, camera, renderer, player, obstacles, gems } = gameRef.current;

    // Jump physics
    if (gameRef.current.isJumping) {
      player.position.y += gameRef.current.jumpVelocity;
      gameRef.current.jumpVelocity -= 0.015;
      
      if (player.position.y <= 0.6) {
        player.position.y = 0.6;
        gameRef.current.isJumping = false;
        gameRef.current.jumpVelocity = 0;
      }
    }

    // Rotate gems
    gems.forEach(gem => {
      gem.rotation.y += 0.05;
      gem.position.y = 1.5 + Math.sin(Date.now() * 0.003 + gem.position.z) * 0.2;
    });

    // Move obstacles and gems toward player
    const speed = gameRef.current.speed;
    
    obstacles.forEach((obstacle, index) => {
      obstacle.position.z += speed;
      
      // Collision detection
      if (
        Math.abs(obstacle.position.x - player.position.x) < 1 &&
        Math.abs(obstacle.position.z - player.position.z) < 1 &&
        player.position.y < obstacle.geometry.parameters.height + 0.3
      ) {
        // Game over
        setGameState(prev => ({
          ...prev,
          isPlaying: false,
          isGameOver: true,
          highScore: Math.max(prev.highScore, gameRef.current!.score),
        }));
        return;
      }
      
      // Remove passed obstacles
      if (obstacle.position.z > 10) {
        scene.remove(obstacle);
        obstacles.splice(index, 1);
      }
    });

    gems.forEach((gem, index) => {
      gem.position.z += speed;
      
      // Gem collection
      if (
        Math.abs(gem.position.x - player.position.x) < 1 &&
        Math.abs(gem.position.z - player.position.z) < 1 &&
        Math.abs(gem.position.y - player.position.y) < 1.5
      ) {
        scene.remove(gem);
        gems.splice(index, 1);
        gameRef.current!.score += 10;
        setGameState(prev => ({ ...prev, score: gameRef.current!.score }));
      }
      
      // Remove passed gems
      if (gem.position.z > 10) {
        scene.remove(gem);
        gems.splice(index, 1);
      }
    });

    // Spawn new obstacles and gems
    if (Math.random() < 0.02) createObstacle();
    if (Math.random() < 0.015) createGem();

    // Gradually increase speed
    gameRef.current.speed += 0.00002;

    renderer.render(scene, camera);
    gameRef.current.animationId = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, createObstacle, createGem]);

  useEffect(() => {
    initGame();
    return () => {
      if (gameRef.current) {
        cancelAnimationFrame(gameRef.current.animationId);
        gameRef.current.renderer.dispose();
      }
    };
  }, [initGame]);

  useEffect(() => {
    if (gameState.isPlaying) {
      gameLoop();
    }
    return () => {
      if (gameRef.current) {
        cancelAnimationFrame(gameRef.current.animationId);
      }
    };
  }, [gameState.isPlaying, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gameState.isPlaying && !gameState.isGameOver) {
          startGame();
        } else if (gameState.isPlaying) {
          jump();
        } else if (gameState.isGameOver) {
          startGame();
        }
      }
    };

    const handleClick = () => {
      if (!gameState.isPlaying && !gameState.isGameOver) {
        startGame();
      } else if (gameState.isPlaying) {
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, [gameState.isPlaying, gameState.isGameOver, jump, startGame]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Score UI */}
      <div className="absolute top-6 left-6 game-ui">
        <p className="font-medieval text-2xl text-primary text-shadow-torchlight">
          Score: {gameState.score}
        </p>
      </div>
      
      <div className="absolute top-6 right-6 game-ui">
        <p className="font-medieval text-lg text-muted-foreground">
          Best: {gameState.highScore}
        </p>
      </div>

      {/* Start Screen */}
      {!gameState.isPlaying && !gameState.isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center parchment-bg p-10 rounded-xl max-w-md">
            <h1 className="font-medieval text-5xl text-primary text-shadow-torchlight mb-4">
              Medieval Runner
            </h1>
            <p className="font-cinzel text-foreground mb-2">
              Jump over obstacles, collect gems!
            </p>
            <p className="font-cinzel text-muted-foreground text-sm mb-8">
              Press SPACE or Click to jump
            </p>
            <button onClick={startGame} className="btn-medieval">
              Begin Quest
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center parchment-bg p-10 rounded-xl max-w-md">
            <h2 className="font-medieval text-4xl text-destructive mb-4">
              Quest Failed
            </h2>
            <p className="font-cinzel text-foreground text-xl mb-2">
              Final Score: <span className="text-primary">{gameState.score}</span>
            </p>
            {gameState.score >= gameState.highScore && gameState.score > 0 && (
              <p className="font-medieval text-accent mb-4 animate-pulse-glow">
                ✦ New High Score! ✦
              </p>
            )}
            <button onClick={startGame} className="btn-medieval mt-4">
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Controls hint */}
      {gameState.isPlaying && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <p className="font-cinzel text-sm text-muted-foreground/60">
            SPACE / Click to Jump
          </p>
        </div>
      )}
    </div>
  );
};

export default MedievalRunner;
