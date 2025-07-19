// Game Configuration - ngrok URL
const SERVER_URL = 'https://dobby-runner.onrender.com';

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

// Responsive canvas dimensions
let GAME_WIDTH = isMobile ? Math.min(window.innerWidth - 20, 400) : 1200;
let GAME_HEIGHT = isMobile ? Math.min(window.innerHeight * 0.75, 500) : 600;
const GROUND_Y = isMobile ? GAME_HEIGHT - 80 : 520;
const GRAVITY = 0.5;
const JUMP_FORCE = -16;
const MAX_JUMP_FORCE = -50;
const BASE_SPEED = 5;
const JUMP_CHARGE_RATE = 0.4;

// Game State
let gameState = {
    running: false,
    score: 0,
    xp: 0,
    level: 1,
    speed: BASE_SPEED,
    gameTime: 0,
    events: [], // For anti-cheat validation
    speedBoostActive: false,
    speedBoostTimer: 0,
    speedBoostMultiplier: 2.0 // 100% speed increase
};

// Screen shake system
let screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };

// Upgrade notification system
let upgradeNotification = {
    active: false,
    message: '',
    timer: 0,
    maxTimer: 180, // 3 seconds at 60fps
    fadeTime: 30   // 0.5 second fade
};

function addScreenShake(intensity, duration) {
    screenShake.intensity = Math.max(screenShake.intensity, intensity);
    screenShake.duration = Math.max(screenShake.duration, duration);
}

function updateScreenShake() {
    if (screenShake.duration > 0) {
        screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.duration--;
        screenShake.intensity *= 0.9; // Fade out
    } else {
        screenShake.x = 0;
        screenShake.y = 0;
        screenShake.intensity = 0;
    }
}

function showUpgradeNotification(level) {
    const messages = {
        2: 'UPGRADED TO Early AGI',
        3: 'UPGRADED TO Advanced AGI',
        4: 'UPGRADED TO Sentient AGI'
    };
    
    // Only show notifications for levels 2-4
    if (messages[level]) {
        upgradeNotification.active = true;
        upgradeNotification.message = messages[level];
        upgradeNotification.timer = upgradeNotification.maxTimer;
    }
}

function updateUpgradeNotification() {
    if (upgradeNotification.active) {
        upgradeNotification.timer--;
        if (upgradeNotification.timer <= 0) {
            upgradeNotification.active = false;
        }
    }
}

function drawUpgradeNotification() {
    if (!upgradeNotification.active) return;
    
    const progress = upgradeNotification.timer / upgradeNotification.maxTimer;
    let alpha = 1;
    
    // Fade in/out effect
    if (upgradeNotification.timer > upgradeNotification.maxTimer - upgradeNotification.fadeTime) {
        // Fade in
        alpha = (upgradeNotification.maxTimer - upgradeNotification.timer) / upgradeNotification.fadeTime;
    } else if (upgradeNotification.timer < upgradeNotification.fadeTime) {
        // Fade out
        alpha = upgradeNotification.timer / upgradeNotification.fadeTime;
    }
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Background box
    const boxWidth = 400;
    const boxHeight = 80;
    const boxX = (GAME_WIDTH - boxWidth) / 2;
    const boxY = 150;
    
    // Gradient background
    const gradient = ctx.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0.9)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // Border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Text
    ctx.fillStyle = '#8B4513';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(upgradeNotification.message, GAME_WIDTH / 2, boxY + boxHeight / 2 + 8);
    
    // Sparkle effects
    for (let i = 0; i < 6; i++) {
        const sparkleX = boxX + Math.random() * boxWidth;
        const sparkleY = boxY + Math.random() * boxHeight;
        const sparkleSize = 2 + Math.sin(gameState.gameTime * 0.3 + i) * 2;
        
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

// Static Branding System - part of background
function drawBranding() {
    // No text, no floating - just static background elements
}

// Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set responsive canvas dimensions
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// Setup mobile controls
if (isMobile) {
    setupMobileControls();
}

// Donut Browser branding images
const brandingImages = [];
const brandImageNames = [
    'sentient-logo.png',
    'sentient-banner.png',
    'sentient-logo.png'
];

// New branding image for levels 2+
const newBrandingImage = new Image();

// Donut character sprites
const donutSprites = {
    run: [],
    jump: null
};

// Level 2 character sprites
const level2Sprites = {
    run: [],
    jump: null
};

// Level 3 character sprites
const level3Sprites = {
    run: [],
    jump: null
};

// Level 4 character sprites
const level4Sprites = {
    run: [],
    jump: null
};

// Level 5 character sprites
const level5Sprites = {
    run: [],
    jump: null
};

// Cat obstacle sprites
const catSprites = {
    closedMouth: null,
    openMouth: null
};

// Dog house sprite (replaces pan with fire)
const trashCanSprite = new Image();

// Rotating knife sprite (replaces spoons)
const rotatingKnifeSprite = new Image();

// Bone sprite (replaces coffeepot)
const coffeeMugSprite = new Image();

// Ball sprite for XP collectibles
const ballSprite = new Image();

// Vertical moving dragon sprite
const verticalCharacterSprite = new Image();

// Marshmallow floor sprite (unused)
// const marshmallowFloorSprite = new Image();

// Load images
function loadImages() {
    // Load branding images
    brandImageNames.forEach((imageName) => {
        const img = new Image();
        img.src = imageName;
        img.onload = () => {
            console.log(`Loaded ${imageName}`);
        };
        img.onerror = () => {
            console.error(`Failed to load ${imageName}`);
        };
        brandingImages.push(img);
    });
    
    // Load donut sprites
    const runSprites = ['dobby.png', 'dobby.png'];
    runSprites.forEach((spriteName, index) => {
        const img = new Image();
        img.src = spriteName;
        img.onload = () => {
            console.log(`Loaded ${spriteName}`);
        };
        img.onerror = () => {
            console.error(`Failed to load ${spriteName}`);
        };
        donutSprites.run.push(img);
    });
    
    // Load jump sprite
    const jumpImg = new Image();
    jumpImg.src = 'dobby.png';
    jumpImg.onload = () => {
        console.log('Loaded dobby.png');
    };
    jumpImg.onerror = () => {
        console.error('Failed to load dobby.png');
    };
    donutSprites.jump = jumpImg;
    
    // Load level 2 character sprites (using same image for all animations for now)
    const level2RunImg1 = new Image();
    level2RunImg1.src = 'dobby.png';
    level2RunImg1.onload = () => {
        console.log('Loaded level 2 run sprite 1');
    };
    level2RunImg1.onerror = () => {
        console.error('Failed to load level 2 run sprite 1');
    };
    level2Sprites.run.push(level2RunImg1);
    
    const level2RunImg2 = new Image();
    level2RunImg2.src = 'dobby.png';
    level2RunImg2.onload = () => {
        console.log('Loaded level 2 run sprite 2');
    };
    level2RunImg2.onerror = () => {
        console.error('Failed to load level 2 run sprite 2');
    };
    level2Sprites.run.push(level2RunImg2);
    
    const level2JumpImg = new Image();
    level2JumpImg.src = 'dobby.png';
    level2JumpImg.onload = () => {
        console.log('Loaded level 2 jump sprite');
    };
    level2JumpImg.onerror = () => {
        console.error('Failed to load level 2 jump sprite');
    };
    level2Sprites.jump = level2JumpImg;
    
    // Load level 3 character sprites
    const level3RunImg1 = new Image();
    level3RunImg1.src = 'dobby.png';
    level3RunImg1.onload = () => {
        console.log('Loaded level 3 run sprite 1');
    };
    level3RunImg1.onerror = () => {
        console.error('Failed to load level 3 run sprite 1');
    };
    level3Sprites.run.push(level3RunImg1);
    
    const level3RunImg2 = new Image();
    level3RunImg2.src = 'dobby.png';
    level3RunImg2.onload = () => {
        console.log('Loaded level 3 run sprite 2');
    };
    level3RunImg2.onerror = () => {
        console.error('Failed to load level 3 run sprite 2');
    };
    level3Sprites.run.push(level3RunImg2);
    
    const level3JumpImg = new Image();
    level3JumpImg.src = 'dobby.png';
    level3JumpImg.onload = () => {
        console.log('Loaded level 3 jump sprite');
    };
    level3JumpImg.onerror = () => {
        console.error('Failed to load level 3 jump sprite');
    };
    level3Sprites.jump = level3JumpImg;
    
    // Load level 4 character sprites
    const level4RunImg1 = new Image();
    level4RunImg1.src = 'dobby.png';
    level4RunImg1.onload = () => {
        console.log('Loaded level 4 run sprite 1');
    };
    level4RunImg1.onerror = () => {
        console.error('Failed to load level 4 run sprite 1');
    };
    level4Sprites.run.push(level4RunImg1);
    
    const level4RunImg2 = new Image();
    level4RunImg2.src = 'dobby.png';
    level4RunImg2.onload = () => {
        console.log('Loaded level 4 run sprite 2');
    };
    level4RunImg2.onerror = () => {
        console.error('Failed to load level 4 run sprite 2');
    };
    level4Sprites.run.push(level4RunImg2);
    
    const level4JumpImg = new Image();
    level4JumpImg.src = 'dobby.png';
    level4JumpImg.onload = () => {
        console.log('Loaded level 4 jump sprite');
    };
    level4JumpImg.onerror = () => {
        console.error('Failed to load level 4 jump sprite');
    };
    level4Sprites.jump = level4JumpImg;
    
    // Load level 5 character sprites (moved from level 4)
    const level5RunImg1 = new Image();
    level5RunImg1.src = 'dobby.png';
    level5RunImg1.onload = () => {
        console.log('Loaded level 5 run sprite 1');
    };
    level5RunImg1.onerror = () => {
        console.error('Failed to load level 5 run sprite 1');
    };
    level5Sprites.run.push(level5RunImg1);
    
    const level5RunImg2 = new Image();
    level5RunImg2.src = 'dobby.png';
    level5RunImg2.onload = () => {
        console.log('Loaded level 5 run sprite 2');
    };
    level5RunImg2.onerror = () => {
        console.error('Failed to load level 5 run sprite 2');
    };
    level5Sprites.run.push(level5RunImg2);
    
    const level5JumpImg = new Image();
    level5JumpImg.src = 'dobby.png';
    level5JumpImg.onload = () => {
        console.log('Loaded level 5 jump sprite');
    };
    level5JumpImg.onerror = () => {
        console.error('Failed to load level 5 jump sprite');
    };
    level5Sprites.jump = level5JumpImg;
    
    // Load cat sprites
    const closedMouthImg = new Image();
    closedMouthImg.src = 'closedmouth.png';
    closedMouthImg.onload = () => {
        console.log('Loaded closedmouth.png');
    };
    closedMouthImg.onerror = () => {
        console.error('Failed to load closedmouth.png');
    };
    catSprites.closedMouth = closedMouthImg;
    
    const openMouthImg = new Image();
    openMouthImg.src = 'openmouth.png';
    openMouthImg.onload = () => {
        console.log('Loaded openmouth.png');
    };
    openMouthImg.onerror = () => {
        console.error('Failed to load openmouth.png');
    };
    catSprites.openMouth = openMouthImg;
    
    // Load dog house sprite
    trashCanSprite.src = 'budka.png';
    trashCanSprite.onload = () => {
        console.log('Loaded budka.png');
    };
    trashCanSprite.onerror = () => {
        console.error('Failed to load budka.png');
    };
    
    // Load rotating knife sprite
    rotatingKnifeSprite.src = 'rotating-knife.png';
    rotatingKnifeSprite.onload = () => {
        console.log('Loaded rotating-knife.png');
    };
    rotatingKnifeSprite.onerror = () => {
        console.error('Failed to load rotating-knife.png');
    };
    
    // Load bone sprite
    coffeeMugSprite.src = 'bone.png?' + Date.now(); // Add cache busting
    coffeeMugSprite.onload = () => {
        console.log('✅ Successfully loaded bone.png - Size:', coffeeMugSprite.width, 'x', coffeeMugSprite.height);
    };
    coffeeMugSprite.onerror = () => {
        console.error('❌ Failed to load bone.png from path: bone.png');
    };
    
    // Load ball sprite for XP collectibles
    ballSprite.src = 'ball.png?' + Date.now(); // Add cache busting
    ballSprite.onload = () => {
        console.log('✅ Successfully loaded ball.png - Size:', ballSprite.width, 'x', ballSprite.height);
    };
    ballSprite.onerror = () => {
        console.error('❌ Failed to load ball.png from path: ball.png');
    };
    
    // Load vertical character sprite
    verticalCharacterSprite.src = 'idustris.png';
    verticalCharacterSprite.onload = () => {
        console.log('Loaded idustris.png');
    };
    verticalCharacterSprite.onerror = () => {
        console.error('Failed to load idustris.png');
    };
    
    // Load marshmallow floor sprite (disabled - file not found)
    /*
    marshmallowFloorSprite.src = 'ChatGPT_Image_17_июн._2025_г.__02_51_31-removebg-preview.png';
    marshmallowFloorSprite.onload = () => {
        console.log('Loaded ChatGPT_Image_17_июн._2025_г.__02_51_31-removebg-preview.png');
    };
    marshmallowFloorSprite.onerror = () => {
        console.error('Failed to load ChatGPT_Image_17_июн._2025_г.__02_51_31-removebg-preview.png');
    };
    */
    
    // Load new branding image
    newBrandingImage.src = 'sentient-banner.png';
    newBrandingImage.onload = () => {
        console.log('Loaded sentient-banner.png');
    };
    newBrandingImage.onerror = () => {
        console.error('Failed to load sentient-banner.png');
    };
}

// Player
class Donut {
    constructor() {
        this.x = isMobile ? 60 : 150;
        this.y = GROUND_Y;
        this.width = isMobile ? 50 : 70;
        this.height = isMobile ? 50 : 70;
        this.velocityY = 0;
        this.jumping = false;
        this.rotation = 0;
        this.skin = 1;
        this.wobble = 0;
        this.speedDebuff = 1;
        this.particles = [];
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.canDoubleJump = false;
        this.hasDoubleJumped = false;
    }
    
    update() {
        // Apply gravity
        if (this.y < GROUND_Y || this.velocityY < 0) {
            this.velocityY += GRAVITY;
            this.y += this.velocityY;
            this.jumping = true;
        }
        
        // Land on ground
        if (this.y >= GROUND_Y) {
            this.y = GROUND_Y;
            this.velocityY = 0;
            this.jumping = false;
            this.rotation = 0;
            this.canDoubleJump = false;
            this.hasDoubleJumped = false;
        }
        
        // Update animation
        let currentSprites;
        if (gameState.level >= 5) {
            currentSprites = level5Sprites;
        } else if (gameState.level >= 4) {
            currentSprites = level4Sprites;
        } else if (gameState.level >= 3) {
            currentSprites = level3Sprites;
        } else if (gameState.level >= 2) {
            currentSprites = level2Sprites;
        } else {
            currentSprites = donutSprites;
        }
        if (!this.jumping && currentSprites.run.length > 0) {
            this.animationTimer++;
            // Speed boost makes animation faster for visual effect
            const animationSpeed = gameState.speedBoostActive ? 10 : 20; // Faster during boost
            if (this.animationTimer > animationSpeed) {
                this.animationTimer = 0;
                this.animationFrame = (this.animationFrame + 1) % Math.max(currentSprites.run.length, 1);
            }
        }
        
        // Wobble animation
        this.wobble += 0.1;
        
        // Add speed boost particles - more frequent and intense
        if (gameState.speedBoostActive && Math.random() < 0.7) {
            this.particles.push({
                x: this.x + this.width + 10,
                y: this.y + Math.random() * this.height,
                vx: Math.random() * -6 - 4, // Faster particles
                vy: (Math.random() - 0.5) * 3,
                life: 1.5,
                color: '#00FFFF'
            });
            
            // Add extra particles for more intense effect
            if (Math.random() < 0.5) {
                this.particles.push({
                    x: this.x + this.width + 5,
                    y: this.y + Math.random() * this.height,
                    vx: Math.random() * -4 - 2,
                    vy: (Math.random() - 0.5) * 2,
                    life: 1,
                    color: '#00DDDD'
                });
            }
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5;
            p.life -= 0.05;
            return p.life > 0;
        });
    }
    
    jump() {
        if (!this.jumping) {
            // First jump
            this.velocityY = JUMP_FORCE;
            this.jumping = true;
            this.canDoubleJump = true;
            gameState.events.push({type: 'jump', time: gameState.gameTime});
            
            // Add jump particles
            for (let i = 0; i < 10; i++) {
                this.particles.push({
                    x: this.x + this.width/2,
                    y: this.y + this.height,
                    vx: (Math.random() - 0.5) * 6,
                    vy: Math.random() * -4,
                    life: 1,
                    color: '#9370DB'
                });
            }
        } else if (this.canDoubleJump && !this.hasDoubleJumped) {
            // Double jump
            this.velocityY = JUMP_FORCE * 0.8; // Slightly weaker second jump
            this.hasDoubleJumped = true;
            this.canDoubleJump = false;
            gameState.events.push({type: 'double_jump', time: gameState.gameTime});
            
            // Add special double jump particles
            for (let i = 0; i < 15; i++) {
                this.particles.push({
                    x: this.x + this.width/2,
                    y: this.y + this.height/2,
                    vx: (Math.random() - 0.5) * 8,
                    vy: Math.random() * -6 - 2,
                    life: 1.5,
                    color: '#FFD700' // Gold particles for double jump
                });
            }
        }
    }
    
    draw() {
        // Draw particles
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        });
        ctx.globalAlpha = 1;
        
        
        // Choose sprite based on state and level
        let sprite;
        const wobbleOffset = Math.sin(this.wobble) * 2;
        
        // Determine which sprite set to use based on level
        let currentSprites;
        if (gameState.level >= 5) {
            currentSprites = level5Sprites;
        } else if (gameState.level >= 4) {
            currentSprites = level4Sprites;
        } else if (gameState.level >= 3) {
            currentSprites = level3Sprites;
        } else if (gameState.level >= 2) {
            currentSprites = level2Sprites;
        } else {
            currentSprites = donutSprites;
        }
        
        if (this.jumping && currentSprites.jump && currentSprites.jump.complete) {
            sprite = currentSprites.jump;
        } else if (currentSprites.run.length > 0 && currentSprites.run[this.animationFrame] && currentSprites.run[this.animationFrame].complete) {
            sprite = currentSprites.run[this.animationFrame];
        }
        
        if (sprite) {
            // Draw sprite normally (assuming images have transparent background)
            ctx.drawImage(sprite, this.x, this.y + wobbleOffset, this.width, this.height);
        } else {
            // Fallback drawing
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            
            // Simple donut shape
            ctx.fillStyle = '#FF69B4';
            ctx.beginPath();
            ctx.arc(0, wobbleOffset, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(0, wobbleOffset, this.width/4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }
    
    getSkinColor() {
        switch(this.skin) {
            case 1: return '#D2691E'; // Basic brown
            case 2: return '#FF69B4'; // Pink frosting
            case 3: return '#9370DB'; // Purple frosting
            case 4: return '#FFD700'; // Golden donut
            default: return '#D2691E';
        }
    }
    
    getLightColor() {
        switch(this.skin) {
            case 1: return '#F4A460';
            case 2: return '#FFB6C1';
            case 3: return '#DDA0DD';
            case 4: return '#FFED4B';
            default: return '#F4A460';
        }
    }
    
    getDarkColor() {
        switch(this.skin) {
            case 1: return '#8B4513';
            case 2: return '#C71585';
            case 3: return '#6A0DAD';
            case 4: return '#B8860B';
            default: return '#8B4513';
        }
    }
    
    drawSprinkles() {
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i + this.wobble * 0.1;
            const x = Math.cos(angle) * (this.width/3);
            const y = Math.sin(angle) * (this.width/3);
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle + Math.PI/4);
            
            // Draw rounded sprinkle
            ctx.fillStyle = colors[i % colors.length];
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-3, 0);
            ctx.lineTo(3, 0);
            ctx.stroke();
            
            ctx.restore();
        }
    }
}

// Bullet
class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 10;
        this.speed = 8;
        this.active = true;
        this.trail = [];
    }
    
    update() {
        this.x += this.speed;
        
        // Add to trail
        this.trail.push({x: this.x, y: this.y, life: 1});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
        
        // Update trail
        this.trail.forEach(t => t.life -= 0.1);
        
        if (this.x > GAME_WIDTH) {
            this.active = false;
        }
    }
    
    draw() {
        // Draw trail
        this.trail.forEach((t, i) => {
            ctx.globalAlpha = t.life * 0.5;
            ctx.fillStyle = '#9370DB';
            const size = (i / this.trail.length) * this.width;
            ctx.fillRect(t.x - size/2, t.y - size/4, size, size/2);
        });
        ctx.globalAlpha = 1;
        
        // Draw bullet with gradient
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
        gradient.addColorStop(0, '#DA70D6');
        gradient.addColorStop(0.5, '#9370DB');
        gradient.addColorStop(1, '#8A2BE2');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y, this.height/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#9370DB';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// Obstacles
class Obstacle {
    constructor(type, x) {
        this.type = type;
        this.x = x;
        this.y = GROUND_Y;
        this.active = true;
        this.destroyed = false;
        
        // Cat animation properties for ground-level obstacles
        this.catAnimationFrame = 0;
        this.catAnimationTimer = 0;
        this.isGroundLevel = false;
        
        switch(type) {
            case 'fork':
                this.width = 90;
                this.height = 100;
                const forkOnGround = Math.random() < 0.3;
                this.y = forkOnGround ? GROUND_Y : GROUND_Y - this.height;
                this.isGroundLevel = forkOnGround;
                this.moveVertical = Math.random() < 0.5;
                this.verticalSpeed = this.moveVertical ? (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1) : 0;
                this.originalY = this.y;
                this.verticalRange = 100;
                this.destructible = true;
                break;
            case 'knife':
                this.width = 90;
                this.height = 100;
                const knifeOnGround = Math.random() < 0.3;
                this.y = knifeOnGround ? GROUND_Y : GROUND_Y - this.height;
                this.isGroundLevel = knifeOnGround;
                this.moveHorizontal = Math.random() < 0.4;
                this.horizontalSpeed = this.moveHorizontal ? (Math.random() * 1 + 0.5) * (Math.random() < 0.5 ? 1 : -1) : 0;
                this.originalX = this.x;
                this.horizontalRange = 80;
                this.destructible = true;
                break;
            case 'pan':
                this.width = 100;
                this.height = 110;
                const panOnGround = Math.random() < 0.4;
                this.y = panOnGround ? GROUND_Y : GROUND_Y - this.height;
                this.isGroundLevel = panOnGround;
                // No flame anymore - it's a dog house now
                this.destructible = true;
                break;
            case 'coffeepot':
                this.width = 94;  // 80 * 1.18 = 94.4
                this.height = 94;
                const coffeeOnGround = Math.random() < 0.2;
                this.y = coffeeOnGround ? GROUND_Y - 20 : GROUND_Y - this.height;
                this.isGroundLevel = coffeeOnGround;
                this.destructible = true;
                break;
            case 'jam':
                this.width = 100;
                this.height = 30;
                this.y = GROUND_Y;
                this.isGroundLevel = false; // Jam should keep original graphics
                break;
            case 'spoon':
                this.width = 50;
                this.height = 80;
                this.y = GROUND_Y - 200 + Math.random() * 100;
                this.floatY = this.y;
                this.floatDirection = 1;
                this.floatRange = 150;
                this.moveHorizontal = Math.random() < 0.6;
                this.horizontalSpeed = this.moveHorizontal ? (Math.random() * 1.5 + 0.5) * (Math.random() < 0.5 ? 1 : -1) : 0;
                this.originalX = this.x;
                this.horizontalRange = 100;
                this.rotation = 0;
                this.rotationSpeed = 0.02; // Slow rotation speed
                break;
            case 'bouncebox':
                this.width = 80;
                this.height = 60;
                this.y = GROUND_Y - this.height;
                this.isGroundLevel = false; // Bouncebox should keep original graphics
                this.bouncy = true;
                break;
            case 'woodlog':
                this.width = 90;
                this.height = 100;
                this.y = GROUND_Y - 250 + Math.random() * 200;
                this.rotationSpeed = (Math.random() - 0.5) * 0.1;
                this.rotation = 0;
                this.moveVertical = true;
                this.verticalSpeed = (Math.random() * 1.5 + 0.5) * (Math.random() < 0.5 ? 1 : -1);
                this.originalY = this.y;
                this.verticalRange = 120;
                this.destructible = true;
                break;
            case 'barrel':
                this.width = 60;
                this.height = 80;
                this.y = GROUND_Y - 300 + Math.random() * 150;
                this.moveHorizontal = true;
                this.horizontalSpeed = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1);
                this.originalX = this.x;
                this.horizontalRange = 150;
                this.bounce = 0;
                break;
            case 'crate':
                this.width = 70;
                this.height = 70;
                this.y = GROUND_Y - 200 + Math.random() * 100;
                this.swaySpeed = (Math.random() * 0.05 + 0.02);
                this.swayAmount = Math.random() * 20 + 10;
                this.swayOffset = 0;
                break;
            case 'speedboost':
                this.width = 100;
                this.height = 30;
                this.y = GROUND_Y - this.height;
                this.isGroundLevel = false; // Speedboost should keep original graphics
                this.glow = 0;
                this.glowDirection = 1;
                this.collectible = true; // Mark as collectible
                break;
        }
    }
    
    update() {
        // Speed boost affects obstacles less to keep them visible
        const obstacleMultiplier = gameState.speedBoostActive ? 1.3 : 1; // Only 30% faster, not 100%
        const effectiveSpeed = gameState.speed * obstacleMultiplier;
        this.x -= effectiveSpeed * player.speedDebuff;
        
        // Update cat animation for ground-level obstacles
        if (this.isGroundLevel) {
            this.catAnimationTimer++;
            if (this.catAnimationTimer >= 30) { // Change frame every 30 game ticks (0.5 seconds at 60fps)
                this.catAnimationFrame = (this.catAnimationFrame + 1) % 2; // 0 = closed mouth, 1 = open mouth
                this.catAnimationTimer = 0;
            }
        }
        
        // Vertical movement for forks
        if (this.moveVertical && this.type === 'fork') {
            this.y += this.verticalSpeed;
            if (Math.abs(this.y - this.originalY) > this.verticalRange) {
                this.verticalSpeed *= -1;
            }
            // Keep within bounds
            if (this.y < 50) {
                this.y = 50;
                this.verticalSpeed = Math.abs(this.verticalSpeed);
            }
            if (this.y > GROUND_Y) {
                this.y = GROUND_Y;
                this.verticalSpeed = -Math.abs(this.verticalSpeed);
            }
        }
        
        // Horizontal movement for knives and spoons
        if (this.moveHorizontal && (this.type === 'knife' || this.type === 'spoon')) {
            this.x += this.horizontalSpeed;
            if (Math.abs(this.x - this.originalX) > this.horizontalRange) {
                this.horizontalSpeed *= -1;
            }
        }
        
        // Spoon floating and rotation
        if (this.type === 'spoon') {
            this.floatY += this.floatDirection * 2;
            this.y = this.floatY;
            const centerY = this.originalY || GROUND_Y - 180;
            if (this.floatY > centerY + this.floatRange/2 || this.floatY < centerY - this.floatRange/2) {
                this.floatDirection *= -1;
            }
            // Add rotation
            this.rotation += this.rotationSpeed;
            if (this.rotation > Math.PI * 2) {
                this.rotation -= Math.PI * 2;
            }
        }
        
        // Wood log movement and rotation
        if (this.type === 'woodlog') {
            this.rotation += this.rotationSpeed;
            if (this.moveVertical) {
                this.y += this.verticalSpeed;
                if (Math.abs(this.y - this.originalY) > this.verticalRange) {
                    this.verticalSpeed *= -1;
                }
                // Keep within bounds
                if (this.y < 50) {
                    this.y = 50;
                    this.verticalSpeed = Math.abs(this.verticalSpeed);
                }
                if (this.y > GROUND_Y - this.height) {
                    this.y = GROUND_Y - this.height;
                    this.verticalSpeed = -Math.abs(this.verticalSpeed);
                }
            }
        }
        
        // Barrel movement with bounce
        if (this.type === 'barrel') {
            this.bounce += 0.1;
            if (this.moveHorizontal) {
                this.x += this.horizontalSpeed;
                if (Math.abs(this.x - this.originalX) > this.horizontalRange) {
                    this.horizontalSpeed *= -1;
                }
            }
        }
        
        // Crate swaying movement
        if (this.type === 'crate') {
            this.swayOffset += this.swaySpeed;
            this.x += Math.sin(this.swayOffset) * this.swayAmount * 0.1;
        }
        
        // Speed boost platform glow animation
        if (this.type === 'speedboost') {
            this.glow += this.glowDirection * 0.05;
            if (this.glow > 1) {
                this.glow = 1;
                this.glowDirection = -1;
            } else if (this.glow < 0) {
                this.glow = 0;
                this.glowDirection = 1;
            }
        }
        
        if (this.x + this.width < -100) { // Allow some offscreen movement
            this.active = false;
        }
    }
    
    draw() {
        ctx.save();
        
        // If this is a ground-level obstacle, draw animated cat instead of regular obstacle
        if (this.isGroundLevel && catSprites.closedMouth && catSprites.openMouth && 
            catSprites.closedMouth.complete && catSprites.openMouth.complete) {
            
            // Choose sprite based on animation frame
            const catSprite = this.catAnimationFrame === 0 ? catSprites.closedMouth : catSprites.openMouth;
            
            // Fixed cat size to prevent deformation
            const catWidth = 80;
            const catHeight = 80;
            
            // Position cat at same level as donut (bottom aligned)
            const catX = this.x + (this.width - catWidth) / 2; // Center horizontally  
            const catY = GROUND_Y - catHeight + 10; // Same level as donut, slightly embedded
            
            // Draw the cat sprite with fixed size
            ctx.drawImage(catSprite, catX, catY, catWidth, catHeight);
            
            ctx.restore();
            return;
        }
        
        switch(this.type) {
            case 'fork':
                // Draw dog house sprite instead of fork
                if (!this.destroyed) {
                    if (trashCanSprite && trashCanSprite.complete) {
                        // Draw the dog house image
                        ctx.drawImage(trashCanSprite, this.x, this.y, this.width, this.height);
                    } else {
                    // Fallback if image hasn't loaded
                    ctx.fillStyle = '#FF4500';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    
                    // Main body
                    ctx.fillRect(this.x, this.y, this.width, this.height);
                    ctx.strokeRect(this.x, this.y, this.width, this.height);
                    
                    // Prongs as simple lines
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 4;
                    for (let i = 1; i < 4; i++) {
                        const x = this.x + (this.width / 4) * i;
                        ctx.beginPath();
                        ctx.moveTo(x, this.y);
                        ctx.lineTo(x, this.y + this.height * 0.3);
                        ctx.stroke();
                    }
                    }
                }
                break;
                
            case 'knife':
                // Draw dog house sprite instead of knife
                if (!this.destroyed) {
                    if (trashCanSprite && trashCanSprite.complete) {
                        // Draw the dog house image
                        ctx.drawImage(trashCanSprite, this.x, this.y, this.width, this.height);
                    } else {
                        // Fallback if image hasn't loaded
                        ctx.fillStyle = '#FF6347';
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 2;
                        
                        // Main body
                        ctx.fillRect(this.x, this.y, this.width, this.height);
                        ctx.strokeRect(this.x, this.y, this.width, this.height);
                        
                        // Sharp edge
                        ctx.fillStyle = '#FFE4E1';
                        ctx.fillRect(this.x + this.width * 0.7, this.y, this.width * 0.3, this.height);
                    }
                }
                break;
                
            case 'pan':
                // Draw dog house sprite instead of pan
                if (trashCanSprite && trashCanSprite.complete) {
                    // Draw the trash can image
                    ctx.drawImage(trashCanSprite, this.x, this.y, this.width, this.height);
                } else {
                    // Fallback if image hasn't loaded
                    ctx.fillStyle = '#4A5C5A';
                    ctx.fillRect(this.x, this.y, this.width, this.height);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(this.x, this.y, this.width, this.height);
                    
                    // Draw sad face as fallback
                    ctx.strokeStyle = '#FFF';
                    ctx.lineWidth = 3;
                    // Eyes
                    ctx.beginPath();
                    ctx.moveTo(this.x + this.width * 0.3, this.y + 20);
                    ctx.lineTo(this.x + this.width * 0.3, this.y + 25);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(this.x + this.width * 0.7, this.y + 20);
                    ctx.lineTo(this.x + this.width * 0.7, this.y + 25);
                    ctx.stroke();
                    // Frown
                    ctx.beginPath();
                    ctx.arc(this.x + this.width/2, this.y + this.height * 0.6, this.width * 0.2, Math.PI * 0.2, Math.PI * 0.8);
                    ctx.stroke();
                }
                break;
                
            case 'coffeepot':
                if (!this.destroyed) {
                    // Draw bone sprite
                    ctx.drawImage(coffeeMugSprite, this.x, this.y, this.width, this.height);
                }
                break;
                
            case 'jam':
                // Slowdown platform design (like speedboost but with left arrows)
                const slowGlowIntensity = 0.5 + Math.sin(gameState.gameTime * 0.1) * 0.5;
                
                // Glow effect
                ctx.shadowBlur = 20;
                ctx.shadowColor = `rgba(147, 112, 219, ${slowGlowIntensity})`;
                
                // Main platform with purple gradient
                const slowGradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
                slowGradient.addColorStop(0, `rgba(138, 43, 226, ${slowGlowIntensity})`);
                slowGradient.addColorStop(0.5, `rgba(147, 112, 219, ${slowGlowIntensity})`);
                slowGradient.addColorStop(1, `rgba(138, 43, 226, ${slowGlowIntensity})`);
                ctx.fillStyle = slowGradient;
                ctx.fillRect(this.x, this.y, this.width, this.height);
                
                // Border
                ctx.strokeStyle = '#9370DB';
                ctx.lineWidth = 3;
                ctx.strokeRect(this.x, this.y, this.width, this.height);
                
                // Slowdown arrows (pointing left)
                ctx.fillStyle = '#FFFFFF';
                for (let i = 0; i < 3; i++) {
                    const arrowX = this.x + 60 - i * 25; // Start from right, go left
                    const arrowY = this.y + this.height/2;
                    ctx.beginPath();
                    ctx.moveTo(arrowX + 15, arrowY - 8);
                    ctx.lineTo(arrowX, arrowY);
                    ctx.lineTo(arrowX + 15, arrowY + 8);
                    ctx.closePath();
                    ctx.fill();
                }
                
                ctx.shadowBlur = 0;
                break;
                
            case 'spoon':
                // Draw rotating knife sprite
                if (!this.destroyed) {
                    ctx.save();
                    
                    // Calculate center point for rotation
                    const centerX = this.x + this.width / 2;
                    const centerY = this.y + this.height / 2;
                    
                    // Apply rotation transformation
                    ctx.translate(centerX, centerY);
                    ctx.rotate(this.rotation);
                    
                    if (rotatingKnifeSprite && rotatingKnifeSprite.complete) {
                        // Draw the rotating knife image centered
                        ctx.drawImage(rotatingKnifeSprite, -this.width/2, -this.height/2, this.width, this.height);
                    } else {
                        // Fallback if image hasn't loaded
                        ctx.fillStyle = '#C0C0C0';
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 2;
                        
                        // Main body (centered)
                        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
                        ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
                        
                        // Handle
                        ctx.fillStyle = '#808080';
                        ctx.fillRect(-this.width/2 + this.width * 0.6, -this.height/2 + 5, this.width * 0.4, this.height - 10);
                    }
                    
                    ctx.restore();
                }
                break;
                
            case 'bouncebox':
                // Bounce box design
                ctx.fillStyle = '#8B7355';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x + 5, this.y + 25 + i * 10);
                    ctx.lineTo(this.x + this.width - 5, this.y + 25 + i * 10);
                    ctx.stroke();
                }
                break;
                
            case 'woodlog':
                // Dragon sprite
                if (!this.destroyed) {
                    ctx.save();
                    
                    if (verticalCharacterSprite && verticalCharacterSprite.complete) {
                        // Draw the character sprite
                        ctx.drawImage(verticalCharacterSprite, this.x, this.y, this.width, this.height);
                    } else {
                        // Fallback if image hasn't loaded
                        ctx.fillStyle = '#4169E1';
                        ctx.fillRect(this.x, this.y, this.width, this.height);
                        ctx.strokeStyle = '#000080';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(this.x, this.y, this.width, this.height);
                    }
                    
                    ctx.restore();
                }
                break;
                
            case 'barrel':
                // Moving barrel with bounce
                const bounceY = Math.sin(this.bounce) * 3;
                
                const barrelGradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
                barrelGradient.addColorStop(0, '#CD853F');
                barrelGradient.addColorStop(0.5, '#A0522D');
                barrelGradient.addColorStop(1, '#8B4513');
                
                // Main barrel body
                ctx.fillStyle = barrelGradient;
                ctx.beginPath();
                ctx.roundRect(this.x, this.y + bounceY, this.width, this.height, 8);
                ctx.fill();
                
                // Metal bands
                ctx.fillStyle = '#696969';
                ctx.fillRect(this.x, this.y + bounceY + 15, this.width, 6);
                ctx.fillRect(this.x, this.y + bounceY + this.height - 21, this.width, 6);
                
                // Highlight
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(this.x + 5, this.y + bounceY + 5, this.width/4, this.height - 10);
                break;
                
            case 'crate':
                // Swaying wooden crate
                const crateGradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
                crateGradient.addColorStop(0, '#DEB887');
                crateGradient.addColorStop(0.5, '#D2691E');
                crateGradient.addColorStop(1, '#A0522D');
                
                // Main crate body
                ctx.fillStyle = crateGradient;
                ctx.fillRect(this.x, this.y, this.width, this.height);
                
                // Wood planks
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 2;
                for (let i = 1; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y + (this.height/4) * i);
                    ctx.lineTo(this.x + this.width, this.y + (this.height/4) * i);
                    ctx.stroke();
                }
                
                // Vertical planks
                for (let i = 1; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x + (this.width/3) * i, this.y);
                    ctx.lineTo(this.x + (this.width/3) * i, this.y + this.height);
                    ctx.stroke();
                }
                
                // Metal corners
                ctx.fillStyle = '#696969';
                const cornerSize = 6;
                ctx.fillRect(this.x, this.y, cornerSize, cornerSize);
                ctx.fillRect(this.x + this.width - cornerSize, this.y, cornerSize, cornerSize);
                ctx.fillRect(this.x, this.y + this.height - cornerSize, cornerSize, cornerSize);
                ctx.fillRect(this.x + this.width - cornerSize, this.y + this.height - cornerSize, cornerSize, cornerSize);
                break;
            case 'speedboost':
                // Speed boost platform with glowing effect
                const glowIntensity = 0.5 + this.glow * 0.5;
                
                // Glow effect
                ctx.shadowBlur = 20;
                ctx.shadowColor = `rgba(0, 255, 255, ${glowIntensity})`;
                
                // Main platform
                const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
                gradient.addColorStop(0, `rgba(0, 200, 255, ${glowIntensity})`);
                gradient.addColorStop(0.5, `rgba(0, 255, 255, ${glowIntensity})`);
                gradient.addColorStop(1, `rgba(0, 200, 255, ${glowIntensity})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(this.x, this.y, this.width, this.height);
                
                // Border
                ctx.strokeStyle = '#00FFFF';
                ctx.lineWidth = 3;
                ctx.strokeRect(this.x, this.y, this.width, this.height);
                
                // Speed arrows
                ctx.fillStyle = '#FFFFFF';
                for (let i = 0; i < 3; i++) {
                    const arrowX = this.x + 20 + i * 25;
                    const arrowY = this.y + this.height/2;
                    ctx.beginPath();
                    ctx.moveTo(arrowX, arrowY - 8);
                    ctx.lineTo(arrowX + 15, arrowY);
                    ctx.lineTo(arrowX, arrowY + 8);
                    ctx.closePath();
                    ctx.fill();
                }
                
                ctx.shadowBlur = 0;
                break;
        }
        
        ctx.restore();
    }
}

// Collectibles
class Collectible {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.active = true;
        this.bounce = 0;
        
        if (type === 'xp') {
            this.width = 74;  // 59 * 1.25 = 73.75
            this.height = 74;
        } else if (type === 'teacup') {
            this.width = 60;
            this.height = 60;
        }
    }
    
    update() {
        // Speed boost affects collectibles moderately
        const collectibleMultiplier = gameState.speedBoostActive ? 1.5 : 1; // 50% faster, not 100%
        const effectiveSpeed = gameState.speed * collectibleMultiplier;
        this.x -= effectiveSpeed * player.speedDebuff;
        this.bounce += 0.08; // Slower, gentler bounce
        
        if (this.x + this.width < 0) {
            this.active = false;
        }
    }
    
    draw() {
        const bounceOffset = Math.sin(this.bounce) * 8;
        const glowIntensity = Math.sin(this.bounce * 2) * 0.3 + 0.7;
        
        ctx.save();
        
        if (this.type === 'xp') {
            // Draw ball sprite for XP
            if (ballSprite && ballSprite.complete) {
                ctx.drawImage(ballSprite, this.x, this.y + bounceOffset, this.width, this.height);
                
                // Add a subtle glow effect
                ctx.save();
                ctx.globalAlpha = glowIntensity * 0.3;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#FFD700';
                ctx.drawImage(ballSprite, this.x, this.y + bounceOffset, this.width, this.height);
                ctx.restore();
            } else {
                // Fallback rendering if ball sprite hasn't loaded
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(this.x, this.y + bounceOffset, this.width, this.height);
            }
            
        } else if (this.type === 'teacup') {
            // Coffee mug collectible
            const cupY = this.y + bounceOffset;
            
            // Make bone sprite 18% bigger (1.16 * 1.18 = 1.37)
            const scaleFactor = 1.37;
            const newWidth = this.width * scaleFactor;
            const newHeight = this.height * scaleFactor;
            const offsetX = (newWidth - this.width) / 2;
            const offsetY = (newHeight - this.height) / 2;
            
            // Draw bone sprite with increased size
            ctx.drawImage(coffeeMugSprite, this.x - offsetX, cupY - offsetY, newWidth, newHeight);
            
            // Simple sparkle effect to show it's collectible
            if (Math.sin(this.bounce * 2) > 0.5) {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(this.x + this.width - 10, cupY + 10, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
}

// Game Variables
let player;
let bullets = [];
let obstacles = [];
let collectibles = [];
let backgrounds = [];
let lastObstacleSpawn = 0;
let lastCollectibleSpawn = 0;
let animationId;
let obstacleSpawnDelay = 120; // Frames between obstacles (2 seconds at 60fps)
let collectibleSpawnDelay = 60;

// Player Data
let playerData = {
    nickname: '',
    personalBest: 0,
    gamesPlayed: 0
};

// Initialize Game
function init() {
    player = new Donut();
    bullets = [];
    obstacles = [];
    collectibles = [];
    lastObstacleSpawn = 0;
    lastCollectibleSpawn = 0;
    
    gameState = {
        running: true,
        score: 0,
        xp: 0,
        level: 1,
        speed: BASE_SPEED,
        gameTime: 0,
        events: [],
        speedBoostActive: false,
        speedBoostTimer: 0,
        speedBoostMultiplier: 2.0
    };
    
    // Reset speed tracking variables
    previousSpeedTier = 1;
    
    // Initialize backgrounds
    backgrounds = [
        { x: 0, type: 'kitchen' },
        { x: GAME_WIDTH, type: 'cafe' }
    ];
    
    
    updateUI();
}

// Player Data Management
function loadPlayerData() {
    const saved = localStorage.getItem('donutRunnerPlayer');
    if (saved) {
        playerData = JSON.parse(saved);
        return true;
    }
    return false;
}

function savePlayerData() {
    localStorage.setItem('donutRunnerPlayer', JSON.stringify(playerData));
}

function updatePlayerUI() {
    document.getElementById('currentPlayer').textContent = playerData.nickname;
    document.getElementById('personalBest').textContent = playerData.personalBest;
}

async function setNickname() {
    const nickname = document.getElementById('playerNickname').value.trim();
    if (!nickname || nickname.length < 2) {
        alert('Please enter a nickname (at least 2 characters)');
        return;
    }
    
    // Sanitize nickname
    const cleanNickname = nickname.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
    if (!cleanNickname) {
        alert('Please use only letters, numbers, spaces, hyphens and underscores');
        return;
    }
    
    const oldNickname = playerData.nickname;
    const isChangingNickname = oldNickname && oldNickname !== 'Guest';
    
    // Update server if changing existing nickname
    if (isChangingNickname) {
        try {
            const response = await fetch(`${SERVER_URL}/api/update-nickname`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    oldNickname: oldNickname,
                    newNickname: cleanNickname
                })
            });
            
            const result = await response.json();
            if (!response.ok) {
                alert(result.error || 'Failed to update nickname');
                return;
            }
        } catch (error) {
            console.error('Error updating nickname:', error);
            // Continue anyway - update locally
        }
    }
    
    // Keep personal best when changing nickname
    const currentBest = playerData.personalBest || 0;
    
    playerData.nickname = cleanNickname;
    if (isChangingNickname) {
        // Preserve stats when changing nickname
        playerData.personalBest = currentBest;
        // Keep gamesPlayed
    } else {
        // New player
        playerData.personalBest = 0;
        playerData.gamesPlayed = 0;
    }
    savePlayerData();
    
    showMainMenu();
}

function showMainMenu() {
    document.getElementById('nicknameSetup').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
    updatePlayerUI();
}

function showNicknameSetup() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('nicknameSetup').style.display = 'block';
    document.getElementById('instructions').style.display = 'none'; // Hide instructions
    document.getElementById('playerNickname').value = '';
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('gameSpeed').textContent = gameState.speed.toFixed(1);
    
    // Show/hide speed boost indicator
    const speedBoostIndicator = document.getElementById('speedBoostIndicator');
    if (gameState.speedBoostActive) {
        speedBoostIndicator.style.display = 'block';
        speedBoostIndicator.textContent = `🚀 SPEED BOOST! (${Math.ceil(gameState.speedBoostTimer / 60)}s)`;
    } else {
        speedBoostIndicator.style.display = 'none';
    }
}

// Mobile Controls Setup
function setupMobileControls() {
    const mobileControls = document.getElementById('mobileControls');
    const jumpButton = document.getElementById('jumpButton');
    const shootButton = document.getElementById('shootButton');
    
    // Jump button
    jumpButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.running) {
            player.jump();
        }
    });
    
    // Shoot button
    shootButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.running) {
            shoot();
        }
    });
    
    // Canvas tap for jump (tap anywhere on canvas to jump) or restart game
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        // Check if game over screen is visible
        const gameOverScreen = document.getElementById('gameOverScreen');
        const isGameOverVisible = gameOverScreen && gameOverScreen.style.display === 'block';
        
        if (isGameOverVisible) {
            playAgain();
            return;
        }
        
        if (gameState.running) {
            player.jump();
        }
    });
    
    // Prevent scrolling on mobile
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
}

// Input Handlers
let spacePressed = false;

document.addEventListener('keydown', (e) => {
    // Check if game over screen is visible
    const gameOverScreen = document.getElementById('gameOverScreen');
    const isGameOverVisible = gameOverScreen && gameOverScreen.style.display === 'block';
    
    if (isGameOverVisible) {
        // Handle keys during game over screen
        if (e.key === ' ' || e.key === 'Enter') {
            playAgain();
            e.preventDefault();
            return;
        }
    }
    
    if (!gameState.running) return;
    
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        player.jump();
    } else if (e.key === ' ' && !spacePressed) {
        spacePressed = true;
        shoot();
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameState.running) return;
    
    if (e.key === ' ') {
        spacePressed = false;
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (!gameState.running) return;
    
    // Click anywhere to shoot
    shoot();
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    if (!gameState.running) return;
    e.preventDefault();
    
    // Touch anywhere to shoot
    shoot();
});

// Shooting
function shoot() {
    bullets.push(new Bullet(player.x + player.width, player.y + player.height/2));
    gameState.events.push({type: 'shoot', time: gameState.gameTime});
}

// Spawn Obstacles
function spawnObstacle() {
    // Don't spawn if there are too many obstacles already
    if (obstacles.length >= 3) return;
    
    // Check if last obstacle is far enough
    if (obstacles.length > 0) {
        const lastObstacle = obstacles[obstacles.length - 1];
        if (lastObstacle.x > GAME_WIDTH - 400) return; // Minimum 400px spacing
    }
    
    const types = ['fork', 'knife', 'pan', 'jam', 'spoon', 'bouncebox', 'woodlog', 'barrel', 'crate', 'speedboost'];
    let weights = [15, 15, 12, 8, 8, 12, 10, 7, 5, 10];
    
    // Increase difficulty after level 4
    if (gameState.level >= 4) {
        weights = [12, 12, 15, 8, 8, 12, 12, 9, 7, 12]; // More variety at higher levels
    }
    
    const type = weightedRandom(types, weights);
    obstacles.push(new Obstacle(type, GAME_WIDTH + Math.random() * 200)); // Add some spacing variation
}

// Check if position overlaps with obstacles
function isPositionSafe(x, y, width, height) {
    for (let obstacle of obstacles) {
        if (obstacle.active && !obstacle.destroyed) {
            // Check if new collectible would overlap with obstacle
            if (x < obstacle.x + obstacle.width + 30 && // 30px buffer
                x + width > obstacle.x - 30 &&
                y < obstacle.y + obstacle.height + 30 &&
                y + height > obstacle.y - 30) {
                return false;
            }
        }
    }
    return true;
}

// Spawn Collectibles
function spawnCollectible() {
    // Don't spawn too many collectibles
    if (collectibles.length >= 6) return; // Increased from 4 to 6
    
    const type = Math.random() < 0.55 ? 'xp' : 'teacup'; // More balanced - 55% XP, 45% teacups
    let x, y;
    let attempts = 0;
    
    do {
        x = GAME_WIDTH + Math.random() * 200;
        
        if (type === 'xp') {
            // XP on ground level where donut runs
            if (Math.random() < 0.8) {
                y = GROUND_Y - 35; // Right on ground level, easy to collect
            } else {
                y = GROUND_Y - 90; // Slightly higher, still reachable
            }
        } else {
            // Teacups at various heights but accessible
            y = 150 + Math.random() * 200;
        }
        attempts++;
    } while (!isPositionSafe(x, y, 60, 60) && attempts < 10);
    
    // If we couldn't find a safe position after 10 attempts, skip this spawn
    if (attempts < 10) {
        collectibles.push(new Collectible(type, x, y));
    }
}

// Weighted Random Selection
function weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) return items[i];
    }
    return items[0];
}

// Collision Detection
function checkCollisions() {
    // Player vs Obstacles
    obstacles.forEach(obstacle => {
        if (!obstacle.active || obstacle.destroyed) return;
        
        // Use special collision detection for ground-level cat obstacles
        const collisionDetected = obstacle.isGroundLevel ? 
            isCollidingWithCat(player, obstacle) : 
            isColliding(player, obstacle);
            
        if (collisionDetected) {
            if (obstacle.type === 'jam') {
                player.speedDebuff = 0.5;
                setTimeout(() => player.speedDebuff = 1, 1000);
                obstacle.active = false;
            } else if (obstacle.type === 'bouncebox') {
                // Bounce the player high
                player.velocityY = -30;
                player.jumping = true;
                
                // Add screen shake for bounce effect
                addScreenShake(8, 15);
                
                // Add bounce particles
                for (let i = 0; i < 15; i++) {
                    player.particles.push({
                        x: player.x + player.width/2,
                        y: player.y + player.height,
                        vx: (Math.random() - 0.5) * 8,
                        vy: Math.random() * -6,
                        life: 1,
                        color: '#FF0000'
                    });
                }
                
                // Don't remove the bounce box, so player can use it multiple times
            } else if (obstacle.type === 'speedboost') {
                // Activate 5-second speed boost
                gameState.speedBoostActive = true;
                gameState.speedBoostTimer = 300; // 5 seconds at 60fps
                
                console.log(`🚀 SPEED BOOST ACTIVATED!`);
                console.log(`Background speed: ${gameState.speed.toFixed(1)} → ${(gameState.speed * gameState.speedBoostMultiplier).toFixed(1)} (+100%)`);
                console.log(`Obstacles speed: ${gameState.speed.toFixed(1)} → ${(gameState.speed * 1.3).toFixed(1)} (+30%)`);
                console.log(`Collectibles speed: ${gameState.speed.toFixed(1)} → ${(gameState.speed * 1.5).toFixed(1)} (+50%)`);
                
                // Add collection particles
                for (let i = 0; i < 20; i++) {
                    player.particles.push({
                        x: obstacle.x + obstacle.width/2,
                        y: obstacle.y + obstacle.height/2,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 8,
                        life: 1,
                        color: '#00FFFF'
                    });
                }
                
                // Add positive screen shake for boost effect
                addScreenShake(5, 10);
                
                // Remove the speed boost platform
                obstacle.active = false;
                
                gameState.events.push({type: 'speedboost_collected', time: gameState.gameTime});
            } else {
                // Add screen shake for collision
                addScreenShake(12, 20);
                gameOver();
            }
        }
    });
    
    // Player vs Collectibles
    collectibles.forEach(collectible => {
        if (!collectible.active || collectible.type === 'teacup') return;
        
        if (isColliding(player, collectible)) {
            gameState.xp++;
            gameState.score++; // Add 1 score point for collecting XP on ground
            collectible.active = false;
            gameState.events.push({type: 'collect_xp', time: gameState.gameTime});
            console.log(`💎 Collected XP! +1 point. Total score: ${gameState.score}, XP: ${gameState.xp}`);
            
            // Add collection particles
            for (let i = 0; i < 20; i++) {
                player.particles.push({
                    x: collectible.x + collectible.width/2,
                    y: collectible.y + collectible.height/2,
                    vx: (Math.random() - 0.5) * 10,
                    vy: Math.random() * -8 - 2,
                    life: 1.5,
                    color: '#FFD700'
                });
            }
        }
    });
    
    // Bullets vs Obstacles/Collectibles
    bullets.forEach(bullet => {
        if (!bullet.active) return;
        
        obstacles.forEach(obstacle => {
            if (!obstacle.active || obstacle.destroyed) return;
            
            if (isColliding(bullet, obstacle)) {
                if (obstacle.type === 'woodlog') {
                    obstacle.destroyed = true;
                    obstacle.active = false;
                    bullet.active = false;
                    // Speed boost gives extra points!
                    const pointsEarned = gameState.speedBoostActive ? 4 : 2; // Double points during boost
                    gameState.score += pointsEarned;
                    // Add XP for killing blue character
                    gameState.xp += 2;
                    console.log(`🎯 Hit ${obstacle.type}! +${pointsEarned} points, +2 XP. Total score: ${gameState.score}, XP: ${gameState.xp}`);
                    
                    // Add destruction particles for woodlog
                    if (obstacle.type === 'woodlog') {
                        for (let i = 0; i < 20; i++) {
                            player.particles.push({
                                x: obstacle.x + obstacle.width/2,
                                y: obstacle.y + obstacle.height/2,
                                vx: (Math.random() - 0.5) * 12,
                                vy: Math.random() * -8 - 2,
                                life: 1.5,
                                color: '#4169E1'  // Blue particles for blue character
                            });
                        }
                    }
                } else if (obstacle.type === 'crate' || obstacle.type === 'barrel') {
                    // Crates and barrels are destructible
                    obstacle.destroyed = true;
                    obstacle.active = false;
                    bullet.active = false;
                    // Speed boost gives extra points!
                    const pointsEarned = gameState.speedBoostActive ? 6 : 3; // Double points during boost
                    gameState.score += pointsEarned;
                    console.log(`🎯 Hit ${obstacle.type}! +${pointsEarned} points. Total score: ${gameState.score}`);
                    
                    // Add destruction particles
                    for (let i = 0; i < 20; i++) {
                        player.particles.push({
                            x: obstacle.x + obstacle.width/2,
                            y: obstacle.y + obstacle.height/2,
                            vx: (Math.random() - 0.5) * 12,
                            vy: Math.random() * -8 - 2,
                            life: 1.5,
                            color: '#8B4513'
                        });
                    }
                }
            }
        });
        
        collectibles.forEach(collectible => {
            if (!collectible.active || collectible.type !== 'teacup') return;
            
            // Extended collision detection - check if bullet is in range even off-screen
            const extendedCollision = 
                bullet.x < collectible.x + collectible.width + 100 && // Extra range for off-screen
                bullet.x + bullet.width > collectible.x - 100 &&
                bullet.y < collectible.y + collectible.height &&
                bullet.y + bullet.height > collectible.y;
                
            if (extendedCollision) {
                // Speed boost gives extra points and XP!
                const pointsEarned = gameState.speedBoostActive ? 10 : 5; // Double points during boost
                const xpEarned = gameState.speedBoostActive ? 10 : 5; // Double XP during boost
                gameState.score += pointsEarned;
                gameState.xp += xpEarned;
                console.log(`🎯 Hit teacup! +${pointsEarned} points, +${xpEarned} XP. Total score: ${gameState.score}`);
                collectible.active = false;
                bullet.active = false;
                gameState.events.push({type: 'hit_teacup', time: gameState.gameTime});
                
                // Add explosion particles
                for (let i = 0; i < 30; i++) {
                    player.particles.push({
                        x: collectible.x + collectible.width/2,
                        y: collectible.y + collectible.height/2,
                        vx: (Math.random() - 0.5) * 15,
                        vy: (Math.random() - 0.5) * 15,
                        life: 2,
                        color: ['#FF6347', '#FFD700', '#FF69B4', '#00CED1'][Math.floor(Math.random() * 4)]
                    });
                }
            }
        });
    });
}

function isColliding(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// Special collision detection for ground-level cat obstacles
function isCollidingWithCat(player, obstacle) {
    if (!obstacle.isGroundLevel) {
        return isColliding(player, obstacle);
    }
    
    // Fixed cat dimensions
    const catWidth = 80;
    const catHeight = 80;
    
    // Cat position (matches rendering position)
    const catX = obstacle.x + (obstacle.width - catWidth) / 2;
    const catY = GROUND_Y - catHeight + 10;
    
    // Check collision with cat's actual visual bounds
    return player.x < catX + catWidth &&
           player.x + player.width > catX &&
           player.y < catY + catHeight &&
           player.y + player.height > catY;
}

// Global variable to track previous speed tier
let previousSpeedTier = 0;

// Level Progression
function updateLevel() {
    const oldLevel = gameState.level;
    
    // Update level based on score
    if (gameState.score >= 300) {
        gameState.level = 4;
        player.skin = 4;
    } else if (gameState.score >= 200) {
        gameState.level = 3;
        player.skin = 3;
    } else if (gameState.score >= 100) {
        gameState.level = 2;
        player.skin = 2;
    } else {
        gameState.level = 1;
        player.skin = 1;
    }
    
    // New speed system based on level
    const oldSpeed = gameState.speed;
    if (gameState.level === 1) {
        gameState.speed = BASE_SPEED;
    } else {
        // Level 2: 30% slower than old level 2 (was 1.5x, now 1.05x)
        // Level 3+: increase by 25% each level from level 2 base
        gameState.speed = BASE_SPEED * 1.05 * Math.pow(1.25, gameState.level - 2);
    }
    
    const currentSpeedTier = gameState.level;
    
    // Show speed up particles when level changes
    if (currentSpeedTier > previousSpeedTier && gameState.score > 0) {
        gameState.events.push({type: 'speed_up', level: currentSpeedTier, time: gameState.gameTime});
        
        // Add screen shake for speed up
        addScreenShake(10, 30);
        
        // Speed up celebration particles (orange/red theme)
        for (let i = 0; i < 30; i++) {
            player.particles.push({
                x: player.x + player.width/2,
                y: player.y + player.height/2,
                vx: (Math.random() - 0.5) * 25,
                vy: Math.random() * -12 - 3,
                life: 2,
                color: ['#FF4500', '#FF6347', '#FFA500', '#FFD700'][Math.floor(Math.random() * 4)]
            });
        }
        
        // Show speed up notification
        console.log(`🔥 SPEED UP! Score: ${gameState.score}, Level: ${gameState.level}`);
        console.log(`Speed: ${oldSpeed.toFixed(1)} → ${gameState.speed.toFixed(1)} (Level ${currentSpeedTier})`);
        
        // Update previous speed tier
        previousSpeedTier = currentSpeedTier;
    }
    
    // Show level up notification
    if (oldLevel !== gameState.level) {
        console.log(`📈 LEVEL UP! Level ${oldLevel} → ${gameState.level}`);
        
        // Show upgrade notification
        showUpgradeNotification(gameState.level);
        
        // Add level up particles
        for (let i = 0; i < 50; i++) {
            player.particles.push({
                x: player.x + player.width/2,
                y: player.y + player.height/2,
                vx: (Math.random() - 0.5) * 20,
                vy: Math.random() * -15 - 5,
                life: 3,
                color: ['#FFD700', '#FF69B4', '#00CED1', '#9370DB'][Math.floor(Math.random() * 4)]
            });
        }
        
        // Add extra screen shake for level up
        addScreenShake(15, 40);
    }
    
    if (oldLevel !== gameState.level) {
        gameState.events.push({type: 'level_up', level: gameState.level, time: gameState.gameTime});
        
        // Level up celebration particles
        for (let i = 0; i < 50; i++) {
            player.particles.push({
                x: player.x + player.width/2,
                y: player.y + player.height/2,
                vx: (Math.random() - 0.5) * 20,
                vy: Math.random() * -15 - 5,
                life: 3,
                color: ['#FFD700', '#FF69B4', '#00CED1', '#9370DB'][Math.floor(Math.random() * 4)]
            });
        }
    }
}

// Draw Background
function drawBackground() {
    // Animated sky gradient based on level
    const time = gameState.gameTime * 0.01;
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    
    switch(gameState.level) {
        case 1:
            // Beautiful blue to warm yellow (original)
            gradient.addColorStop(0, `hsl(${200 + Math.sin(time) * 10}, 70%, 80%)`);
            gradient.addColorStop(1, `hsl(${45 + Math.sin(time * 0.7) * 5}, 80%, 85%)`);
            break;
        case 2:
            // Soft pink to lavender
            gradient.addColorStop(0, `hsl(${330 + Math.sin(time) * 8}, 65%, 85%)`);
            gradient.addColorStop(1, `hsl(${270 + Math.sin(time * 0.8) * 10}, 60%, 82%)`);
            break;
        case 3:
            // Mint green to soft cyan
            gradient.addColorStop(0, `hsl(${160 + Math.sin(time) * 12}, 55%, 80%)`);
            gradient.addColorStop(1, `hsl(${190 + Math.sin(time * 0.9) * 8}, 65%, 85%)`);
            break;
        case 4:
            // Warm coral to soft peach
            gradient.addColorStop(0, `hsl(${15 + Math.sin(time) * 10}, 75%, 78%)`);
            gradient.addColorStop(1, `hsl(${35 + Math.sin(time * 1.1) * 12}, 80%, 82%)`);
            break;
        case 5:
            // Magic rainbow (unicorn theme)
            gradient.addColorStop(0, `hsl(${280 + Math.sin(time) * 20}, 70%, 80%)`);
            gradient.addColorStop(0.5, `hsl(${320 + Math.sin(time * 1.2) * 15}, 75%, 85%)`);
            gradient.addColorStop(1, `hsl(${200 + Math.sin(time * 0.8) * 18}, 65%, 83%)`);
            break;
        default:
            // For level 6+ - rotating rainbow
            const baseHue = ((gameState.level - 6) * 60 + gameState.gameTime * 0.5) % 360;
            gradient.addColorStop(0, `hsl(${baseHue + Math.sin(time) * 15}, 70%, 80%)`);
            gradient.addColorStop(1, `hsl(${(baseHue + 120) % 360 + Math.sin(time * 0.9) * 12}, 75%, 85%)`);
            break;
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    
    // Moving backgrounds
    backgrounds.forEach(bg => {
        // Background moves faster during speed boost to match game speed
        const backgroundSpeed = gameState.speedBoostActive ? 
            gameState.speed * gameState.speedBoostMultiplier : 
            gameState.speed;
        
        bg.x -= backgroundSpeed * 0.5;
        
        if (bg.x + GAME_WIDTH < 0) {
            bg.x = GAME_WIDTH;
            bg.type = ['kitchen', 'cafe', 'sweetshop'][Math.floor(Math.random() * 3)];
        }
        
        drawBackgroundType(bg.x, bg.type);
    });
    
    // Enhanced Ground with grass
    const groundGradient = ctx.createLinearGradient(0, GROUND_Y + 50, 0, GAME_HEIGHT);
    groundGradient.addColorStop(0, '#A0522D');
    groundGradient.addColorStop(0.3, '#8B4513');
    groundGradient.addColorStop(1, '#654321');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, GROUND_Y + 50, GAME_WIDTH, GAME_HEIGHT - GROUND_Y - 50);
    
    // Grass on top
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, GROUND_Y + 45, GAME_WIDTH, 8);
    
    // Gentle grass blades
    ctx.strokeStyle = '#32CD32';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < GAME_WIDTH; i += 15) {
        const grassHeight = 5 + Math.sin((i + gameState.gameTime * 0.02) * 0.1) * 1; // Slower movement
        ctx.beginPath();
        ctx.moveTo(i, GROUND_Y + 50);
        ctx.lineTo(i + Math.sin(gameState.gameTime * 0.01 + i * 0.1) * 1, GROUND_Y + 50 - grassHeight);
        ctx.stroke();
    }
    
    // Underground pattern with gems
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1;
    for (let i = 0; i < GAME_WIDTH; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, GROUND_Y + 70);
        ctx.lineTo(i + 20, GROUND_Y + 90);
        ctx.stroke();
        
        // Occasional gems
        if (Math.random() < 0.1) {
            ctx.fillStyle = ['#FF69B4', '#00CED1', '#FFD700'][Math.floor(Math.random() * 3)];
            ctx.beginPath();
            ctx.arc(i + 10, GROUND_Y + 80, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawBackgroundType(x, type) {
    ctx.save();
    ctx.translate(x, 0);
    
    // Show branding less frequently - only every 3rd background section
    const shouldShowBranding = Math.floor(x / 1200) % 3 === 0;
    
    if (shouldShowBranding) {
        // Calculate fade-out effect when branding goes off-screen
        let fadeAlpha = 0.6;
        
        switch(type) {
            case 'kitchen':
                // Single wider branding in kitchen - positioned like clouds
                if (brandingImages[0] && brandingImages[0].complete) {
                    const brandingX = 200;
                    const brandingWidth = 160;
                    
                    // Fade out when going off left edge
                    if (x + brandingX + brandingWidth < 0) {
                        fadeAlpha = 0; // Completely off screen
                    } else if (x + brandingX < 0) {
                        // Partially off screen - fade based on how much is visible
                        const visibleWidth = (x + brandingX + brandingWidth);
                        fadeAlpha = 0.6 * (visibleWidth / brandingWidth);
                    }
                    
                    if (fadeAlpha > 0) {
                        ctx.globalAlpha = fadeAlpha;
                        ctx.drawImage(brandingImages[0], brandingX, 70, 128, 115);
                        ctx.globalAlpha = 1;
                    }
                }
                break;
                
            case 'cafe':
                // Use new branding for levels 2+ or old branding for level 1
                const brandingToUse = (gameState.level >= 2 && newBrandingImage && newBrandingImage.complete) ? newBrandingImage : brandingImages[1];
                
                if (brandingToUse && brandingToUse.complete) {
                    const brandingX = 400;
                    const brandingWidth = 288;  // Even wider for text banner
                    
                    // Fade out when going off left edge
                    if (x + brandingX + brandingWidth < 0) {
                        fadeAlpha = 0;
                    } else if (x + brandingX < 0) {
                        const visibleWidth = (x + brandingX + brandingWidth);
                        fadeAlpha = 0.6 * (visibleWidth / brandingWidth);
                    }
                    
                    if (fadeAlpha > 0) {
                        ctx.globalAlpha = fadeAlpha;
                        ctx.drawImage(brandingToUse, brandingX, 50, brandingWidth, 173);
                        ctx.globalAlpha = 1;
                    }
                }
                break;
                
            case 'sweetshop':
                // Use new branding for levels 2+ or old branding for level 1
                const sweetshopBrandingToUse = (gameState.level >= 2 && newBrandingImage && newBrandingImage.complete) ? newBrandingImage : brandingImages[2];
                
                if (sweetshopBrandingToUse && sweetshopBrandingToUse.complete) {
                    const brandingX = 100;
                    const brandingWidth = (gameState.level >= 2 && newBrandingImage && newBrandingImage.complete) ? 288 : 128;  // Wider for text banner on level 2+, smaller logo
                    
                    // Fade out when going off left edge
                    if (x + brandingX + brandingWidth < 0) {
                        fadeAlpha = 0;
                    } else if (x + brandingX < 0) {
                        const visibleWidth = (x + brandingX + brandingWidth);
                        fadeAlpha = 0.6 * (visibleWidth / brandingWidth);
                    }
                    
                    if (fadeAlpha > 0) {
                        ctx.globalAlpha = fadeAlpha;
                        ctx.drawImage(sweetshopBrandingToUse, brandingX, 90, brandingWidth, (gameState.level >= 2 && newBrandingImage && newBrandingImage.complete) ? 173 : 115);
                        ctx.globalAlpha = 1;
                    }
                }
                break;
        }
    }
    
    ctx.restore();
}

// Draw speed lines effect during boost
function drawSpeedLines() {
    ctx.save();
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    
    // Draw horizontal speed lines - more intense
    for (let i = 0; i < 25; i++) {
        const y = Math.random() * GAME_HEIGHT;
        const x = GAME_WIDTH - (gameState.gameTime * 30 + i * 60) % (GAME_WIDTH + 150);
        const length = 80 + Math.random() * 120;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - length, y);
        ctx.stroke();
    }
    
    // Add some diagonal speed lines for more effect
    ctx.strokeStyle = '#00DDFF';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    
    for (let i = 0; i < 10; i++) {
        const y = Math.random() * GAME_HEIGHT;
        const x = GAME_WIDTH - (gameState.gameTime * 25 + i * 90) % (GAME_WIDTH + 120);
        const length = 60 + Math.random() * 80;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - length, y - length * 0.2);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Game Loop
function gameLoop() {
    if (!gameState.running) return;
    
    // Update screen shake
    updateScreenShake();
    
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Apply screen shake transformation
    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);
    
    // Update game time
    gameState.gameTime++;
    
    // Update upgrade notification
    updateUpgradeNotification();
    
    // Handle speed boost timer
    if (gameState.speedBoostActive) {
        gameState.speedBoostTimer--;
        if (gameState.speedBoostTimer <= 0) {
            gameState.speedBoostActive = false;
            gameState.speedBoostTimer = 0;
            console.log(`⚡ Speed boost ended. Speed back to: ${gameState.speed.toFixed(1)}`);
        }
    }
    
    // Draw background
    drawBackground();
    
    // Add speed lines effect during speed boost
    if (gameState.speedBoostActive) {
        drawSpeedLines();
        
        // Add slight blue tint to screen during speed boost
        ctx.save();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }
    
    // Spawn obstacles and collectibles at normal rate
    const currentObstacleDelay = Math.max(obstacleSpawnDelay - (gameState.level * 15), 60); // Minimum 1 second
    if (gameState.gameTime - lastObstacleSpawn > currentObstacleDelay) {
        spawnObstacle();
        lastObstacleSpawn = gameState.gameTime;
    }
    
    const currentCollectibleDelay = Math.max(collectibleSpawnDelay - (gameState.level * 10), 50);
    if (gameState.gameTime - lastCollectibleSpawn > currentCollectibleDelay) {
        spawnCollectible();
        lastCollectibleSpawn = gameState.gameTime;
    }
    
    // Update and draw game objects
    player.update();
    player.draw();
    
    bullets = bullets.filter(bullet => {
        bullet.update();
        if (bullet.active) bullet.draw();
        return bullet.active;
    });
    
    obstacles = obstacles.filter(obstacle => {
        obstacle.update();
        if (obstacle.active) obstacle.draw();
        return obstacle.active;
    });
    
    collectibles = collectibles.filter(collectible => {
        collectible.update();
        if (collectible.active) collectible.draw();
        return collectible.active;
    });
    
    // Check collisions
    checkCollisions();
    
    // Update level and UI
    updateLevel();
    updateUI();
    
    // Draw upgrade notification (after screen shake translation)
    drawUpgradeNotification();
    
    // Restore transformation after screen shake
    ctx.restore();
    
    animationId = requestAnimationFrame(gameLoop);
}

// Game Over
function gameOver() {
    gameState.running = false;
    cancelAnimationFrame(animationId);
    
    // Stop music when game ends
    pauseMusic();
    
    playerData.gamesPlayed++;
    
    // Update personal best if needed
    const isNewBest = gameState.score > playerData.personalBest;
    if (isNewBest) {
        playerData.personalBest = gameState.score;
        savePlayerData();
    }
    
    // Update game over screen
    document.getElementById('gameOverPlayer').textContent = playerData.nickname;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOverBest').textContent = playerData.personalBest;
    
    // Highlight if new best
    const finalScoreElement = document.getElementById('finalScore');
    if (isNewBest) {
        finalScoreElement.style.color = '#32CD32';
        finalScoreElement.style.fontWeight = 'bold';
        finalScoreElement.parentElement.innerHTML = '🎉 NEW BEST: <span id="finalScore" style="color: #32CD32; font-weight: bold;">' + gameState.score + '</span>';
    } else {
        finalScoreElement.style.color = '#8B4513';
        finalScoreElement.style.fontWeight = 'normal';
    }
    
    // Show Lock Score button for any positive score
    const lockButton = document.getElementById('lockScoreButton');
    if (gameState.score > 0) {
        lockButton.style.display = 'block';
        lockButton.disabled = false; // Re-enable button for new game
        lockButton.textContent = isNewBest ? '🔒 Lock New Best!' : '🔒 Lock Score';
    } else {
        lockButton.style.display = 'none';
    }
    
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('instructions').style.display = 'none'; // Hide instructions
}

// Lock Score - Submit to leaderboard
async function lockScore() {
    // Disable button to prevent double clicks
    const lockButton = document.getElementById('lockScoreButton');
    lockButton.disabled = true;
    lockButton.textContent = 'Submitting...';
    
    try {
        // Prepare game data for validation - only send important events
        const importantEvents = gameState.events.filter(event => 
            event.type === 'hit_teacup' || 
            event.type === 'collect_xp' || 
            event.type === 'level_up'
        );
        
        const gameData = {
            nickname: playerData.nickname,
            score: gameState.score,
            xp: gameState.xp,
            level: gameState.level,
            gameTime: gameState.gameTime,
            events: importantEvents, // Only send important events
            timestamp: Date.now()
        };
        
        console.log('Submitting game data:', gameData);
        console.log('Game time in seconds:', gameData.gameTime / 60);
        console.log('Score per second:', gameData.score / (gameData.gameTime / 60));
        
        const response = await fetch(`${SERVER_URL}/api/submit-score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(gameData)
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.newBest) {
                alert(`🎉 New high score locked: ${result.newBest} points!`);
            } else if (result.previousBest) {
                alert(`Score not updated. Your best remains: ${result.previousBest} points`);
            } else {
                alert('🎉 Score locked in leaderboard successfully!');
            }
            updatePlayerUI(); // Update best score display
            backToMenu();
        } else {
            const errorData = await response.json();
            console.error('Server error response:', errorData);
            alert(`Failed to submit score: ${errorData.reason || errorData.error || 'Unknown error'}`);
            // Re-enable button on failure
            lockButton.disabled = false;
            lockButton.textContent = '🔒 Lock Score';
        }
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Could not connect to server. Score saved locally only.');
        // Re-enable button on error
        lockButton.disabled = false;
        lockButton.textContent = '🔒 Lock Score';
        // Don't automatically go back to menu on network error
        // Let user choose what to do next
    }
}

// Play Again - Start new game without going to menu
function playAgain() {
    document.getElementById('gameOverScreen').style.display = 'none';
    startGame();
}

// Show Leaderboard
async function showLeaderboard() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('leaderboardScreen').style.display = 'block';
    document.getElementById('instructions').style.display = 'none'; // Hide instructions
    
    try {
        const response = await fetch(`${SERVER_URL}/api/leaderboard`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        const leaderboard = await response.json();
        
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = '';
        
        leaderboard.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = 'leaderboardEntry';
            div.innerHTML = `
                <span>${index + 1}. ${entry.nickname}</span>
                <span>${entry.score} pts</span>
            `;
            leaderboardList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        document.getElementById('leaderboardList').innerHTML = 
            '<p>Could not load leaderboard. Please check your connection.</p>';
    }
}

// Menu Functions
function startGame() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('gameUI').style.display = 'block';
    document.getElementById('instructions').style.display = isMobile ? 'none' : 'block';
    
    // Show mobile controls if on mobile
    if (isMobile) {
        document.getElementById('mobileControls').style.display = 'block';
    }
    
    // Ensure document has focus for keyboard events
    document.body.focus();
    
    // Start playing music when game starts
    playMusic(true);
    
    init();
    gameLoop();
}

function backToMenu() {
    document.getElementById('mainMenu').style.display = 'block';
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('gameUI').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('leaderboardScreen').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    
    // Hide mobile controls
    if (isMobile) {
        document.getElementById('mobileControls').style.display = 'none';
    }
    
    updatePlayerUI(); // Refresh player info
}

// Initialize Event Listeners and App
document.addEventListener('DOMContentLoaded', () => {
    // Load images
    loadImages();
    
    // Load saved player data
    if (loadPlayerData()) {
        showMainMenu();
    } else {
        // First time user - show nickname setup
        document.getElementById('nicknameSetup').style.display = 'block';
    }
    
    // Nickname setup
    document.getElementById('setNicknameButton').addEventListener('click', setNickname);
    document.getElementById('playerNickname').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') setNickname();
    });
    
    // Main menu
    document.getElementById('playButton').addEventListener('click', startGame);
    document.getElementById('leaderboardButton').addEventListener('click', showLeaderboard);
    document.getElementById('changeNicknameButton').addEventListener('click', showNicknameSetup);
    
    // Game over screen
    document.getElementById('lockScoreButton').addEventListener('click', lockScore);
    document.getElementById('playAgainButton').addEventListener('click', playAgain);
    document.getElementById('backToMenuButton').addEventListener('click', backToMenu);
    
    // Leaderboard
    document.getElementById('backToMenuButton2').addEventListener('click', backToMenu);
    
    // Initialize audio controls
    initAudioControls();
});

// Audio Control System
let backgroundMusic = null;
let isMusicPlaying = false;
let musicVolume = 0.3; // 30% volume

function initAudioControls() {
    backgroundMusic = document.getElementById('backgroundMusic');
    const audioButton = document.getElementById('audioButton');
    const volumeRange = document.getElementById('volumeRange');
    
    // Set initial volume
    backgroundMusic.volume = musicVolume;
    
    // Audio button click handler
    audioButton.addEventListener('click', toggleMusic);
    
    // Volume slider handler
    volumeRange.addEventListener('input', (e) => {
        musicVolume = e.target.value / 100;
        backgroundMusic.volume = musicVolume;
        
        // Update button icon based on volume
        updateAudioIcon();
    });
    
    // Removed auto-play - music starts when game starts
}

function startMusicOnFirstInteraction() {
    if (!isMusicPlaying) {
        playMusic();
    }
}

function toggleMusic() {
    if (isMusicPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function playMusic(restart = false) {
    if (restart) {
        backgroundMusic.currentTime = 0;
    }
    backgroundMusic.play().then(() => {
        isMusicPlaying = true;
        updateAudioIcon();
    }).catch(e => {
        console.log('Audio autoplay prevented:', e);
    });
}

function pauseMusic() {
    backgroundMusic.pause();
    isMusicPlaying = false;
    updateAudioIcon();
}

function updateAudioIcon() {
    const audioButton = document.getElementById('audioButton');
    
    if (!isMusicPlaying) {
        audioButton.textContent = '🔇';
    } else if (musicVolume === 0) {
        audioButton.textContent = '🔇';
    } else if (musicVolume < 0.5) {
        audioButton.textContent = '🔉';
    } else {
        audioButton.textContent = '🔊';
    }
}