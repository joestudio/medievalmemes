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
    currentLane: number;
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

    // Lighting - Brighter torchlight ambiance
    const ambientLight = new THREE.AmbientLight(0x5a4030, 0.6);
    scene.add(ambientLight);

    const torchLight1 = new THREE.PointLight(0xff8c42, 2, 25);
    torchLight1.position.set(-3, 4, 0);
    torchLight1.castShadow = true;
    scene.add(torchLight1);

    const torchLight2 = new THREE.PointLight(0xff6b35, 2, 25);
    torchLight2.position.set(3, 4, 0);
    torchLight2.castShadow = true;
    scene.add(torchLight2);

    const frontLight = new THREE.DirectionalLight(0xffd4a3, 0.8);
    frontLight.position.set(0, 10, 10);
    scene.add(frontLight);

    // Create stone texture canvas
    const createStoneTexture = (baseColor: number, size: number = 256) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      // Base color
      const r = (baseColor >> 16) & 255;
      const g = (baseColor >> 8) & 255;
      const b = baseColor & 255;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, size, size);
      
      // Add stone-like noise and variation
      for (let i = 0; i < 800; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 8 + 2;
        const variation = Math.random() * 40 - 20;
        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, r + variation))}, ${Math.min(255, Math.max(0, g + variation))}, ${Math.min(255, Math.max(0, b + variation))})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Add cracks/lines
      ctx.strokeStyle = `rgba(${r - 30}, ${g - 30}, ${b - 30}, 0.5)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, Math.random() * size);
        ctx.lineTo(Math.random() * size, Math.random() * size);
        ctx.stroke();
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    // Ground - Stone floor with texture
    const floorTexture = createStoneTexture(0x6a5a48);
    floorTexture.repeat.set(4, 50);
    const groundGeometry = new THREE.PlaneGeometry(8, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.85,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Stone tile grid lines
    for (let i = 0; i < 50; i++) {
      const lineGeometry = new THREE.PlaneGeometry(8, 0.08);
      const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2520 });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.01;
      line.position.z = -i * 2;
      scene.add(line);
    }
    
    // Vertical tile lines
    for (let x = -3; x <= 3; x += 2) {
      const vLineGeometry = new THREE.PlaneGeometry(0.06, 100);
      const vLineMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2520 });
      const vLine = new THREE.Mesh(vLineGeometry, vLineMaterial);
      vLine.rotation.x = -Math.PI / 2;
      vLine.position.set(x, 0.01, -25);
      scene.add(vLine);
    }

    // Walls with rock texture
    const wallTexture = createStoneTexture(0x5a4a3a);
    wallTexture.repeat.set(2, 20);
    const wallGeometry = new THREE.BoxGeometry(0.8, 6, 100);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.95,
      metalness: 0.02,
    });

    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-4.2, 3, -25);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(4.2, 3, -25);
    scene.add(rightWall);
    
    // Add torch holders on walls
    const torchHolderGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8);
    const torchMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817, metalness: 0.3 });
    
    for (let z = 0; z > -40; z -= 10) {
      const leftTorch = new THREE.Mesh(torchHolderGeometry, torchMaterial);
      leftTorch.position.set(-3.7, 3, z);
      leftTorch.rotation.z = Math.PI / 6;
      scene.add(leftTorch);
      
      const rightTorch = new THREE.Mesh(torchHolderGeometry, torchMaterial);
      rightTorch.position.set(3.7, 3, z);
      rightTorch.rotation.z = -Math.PI / 6;
      scene.add(rightTorch);
      
      // Torch flame glow
      const flameLight = new THREE.PointLight(0xff6622, 0.8, 8);
      flameLight.position.set(-3.5, 3.3, z);
      scene.add(flameLight);
      
      const flameLight2 = new THREE.PointLight(0xff6622, 0.8, 8);
      flameLight2.position.set(3.5, 3.3, z);
      scene.add(flameLight2);
    }

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
      currentLane: 1,
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
    
    const width = 1.2 + Math.random() * 1.2;
    const height = 0.9 + Math.random() * 0.7;
    const geometry = new THREE.BoxGeometry(width, height, 1);
    
    // Brighter, more visible obstacle - dark red/brown stone blocks
    const obstacleColors = [0x8b4513, 0x7a3d10, 0x6b3510];
    const color = obstacleColors[Math.floor(Math.random() * obstacleColors.length)];
    
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x331100,
      emissiveIntensity: 0.15,
    });
    const obstacle = new THREE.Mesh(geometry, material);
    
    // Add edge highlight for better visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xaa6633, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    obstacle.add(edgeLines);
    
    const lanes = [-2, 0, 2];
    obstacle.position.set(
      lanes[Math.floor(Math.random() * lanes.length)],
      height / 2,
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

  const moveLeft = useCallback(() => {
    if (!gameRef.current) return;
    const lanes = [-2, 0, 2];
    if (gameRef.current.currentLane > 0) {
      gameRef.current.currentLane--;
      gameRef.current.player.position.x = lanes[gameRef.current.currentLane];
    }
  }, []);

  const moveRight = useCallback(() => {
    if (!gameRef.current) return;
    const lanes = [-2, 0, 2];
    if (gameRef.current.currentLane < 2) {
      gameRef.current.currentLane++;
      gameRef.current.player.position.x = lanes[gameRef.current.currentLane];
    }
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
      gameRef.current.currentLane = 1;
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
      if (gameState.isPlaying) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          moveLeft();
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          moveRight();
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
  }, [gameState.isPlaying, gameState.isGameOver, jump, startGame, moveLeft, moveRight]);

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
            SPACE/Click to jump • A/D or ←/→ to move
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
            SPACE/Click: Jump • A/D or ←/→: Move
          </p>
        </div>
      )}
    </div>
  );
};

export default MedievalRunner;
