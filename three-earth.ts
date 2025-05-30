declare global {
  interface Window {
    THREE: any;
  }
}

export class EarthVisualization {
  private scene: any;
  private camera: any;
  private renderer: any;
  private earth: any;
  private satellites: any[] = [];
  private animationId: number | null = null;

  constructor(container: HTMLElement) {
    this.init(container);
    this.createEarth();
    this.createSatellites();
    this.animate();
  }

  private init(container: HTMLElement) {
    // Scene
    this.scene = new window.THREE.Scene();

    // Camera
    this.camera = new window.THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // Renderer
    this.renderer = new window.THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new window.THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new window.THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    this.scene.add(directionalLight);
  }

  private createEarth() {
    const geometry = new window.THREE.SphereGeometry(2, 64, 64);
    
    // Create earth material with gradient
    const material = new window.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vec3 baseColor = vec3(0.1, 0.4, 0.8);
          vec3 continentColor = vec3(0.2, 0.6, 0.3);
          
          // Create continent-like patterns
          float continent = sin(vUv.x * 12.0) * cos(vUv.y * 8.0);
          continent = smoothstep(0.2, 0.4, continent);
          
          vec3 color = mix(baseColor, continentColor, continent);
          
          // Add some atmosphere glow
          float atmosphere = 1.0 - dot(normalize(vPosition), vec3(0.0, 0.0, 1.0));
          color += vec3(0.3, 0.6, 1.0) * atmosphere * 0.3;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.earth = new window.THREE.Mesh(geometry, material);
    this.scene.add(this.earth);

    // Add atmosphere
    const atmosphereGeometry = new window.THREE.SphereGeometry(2.1, 64, 64);
    const atmosphereMaterial = new window.THREE.ShaderMaterial({
      transparent: true,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, intensity * 0.3);
        }
      `,
      side: window.THREE.BackSide,
      blending: window.THREE.AdditiveBlending
    });

    const atmosphere = new window.THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.scene.add(atmosphere);
  }

  private createSatellites() {
    const satelliteGeometry = new window.THREE.SphereGeometry(0.05, 8, 8);
    const satelliteMaterial = new window.THREE.MeshBasicMaterial({ color: 0xffff00 });

    // Create satellites at different orbits
    for (let i = 0; i < 8; i++) {
      const satellite = new window.THREE.Mesh(satelliteGeometry, satelliteMaterial);
      
      const angle = (i / 8) * Math.PI * 2;
      const radius = 2.5 + Math.random() * 1.5;
      const inclination = (Math.random() - 0.5) * Math.PI * 0.5;
      
      satellite.userData = {
        angle,
        radius,
        inclination,
        speed: 0.01 + Math.random() * 0.02
      };
      
      this.satellites.push(satellite);
      this.scene.add(satellite);
    }
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    // Rotate earth
    this.earth.rotation.y += 0.005;

    // Update satellites
    this.satellites.forEach(satellite => {
      const userData = satellite.userData;
      userData.angle += userData.speed;
      
      satellite.position.x = Math.cos(userData.angle) * userData.radius;
      satellite.position.y = Math.sin(userData.inclination) * userData.radius;
      satellite.position.z = Math.sin(userData.angle) * userData.radius;
    });

    this.renderer.render(this.scene, this.camera);
  };

  public updateSatellites(satellites: any[]) {
    // Update satellite colors based on status
    this.satellites.forEach((satellite, index) => {
      if (satellites[index]) {
        const status = satellites[index].status;
        let color = 0xffff00; // yellow default
        
        if (status === 'active') color = 0x00ff00; // green
        else if (status === 'maintenance') color = 0xff0000; // red
        else if (status === 'offline') color = 0x888888; // gray
        
        satellite.material.color.setHex(color);
      }
    });
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
