#!/usr/bin/env python3
"""
Consolidated Wordle Manager - combines web app, export, and video generation functionality.
"""

import os
import sys
from typing import Optional

# Add the src directory to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, 'src')
sys.path.insert(0, src_dir)

from utils.common import WordleCommon

def run_web_app():
    """Run the Wordle Statistics Web Application"""
    target_dir = WordleCommon.setup_paths('web')
    
    # Import and run the app
    from wordle_stats_app import app
    
    WordleCommon.print_header("Starting Wordle Statistics Web Application")
    print("🌐 Access at: http://localhost:12001")
    print("⏹️  Press Ctrl+C to stop")
    
    app.run(debug=True, port=12001)

def export_html(output_file: Optional[str] = None):
    """Export Wordle statistics to HTML"""
    target_dir = WordleCommon.setup_paths('web')
    
    # Import the export function
    from wordle_stats_app import export_comprehensive_html
    
    # Determine output file
    if output_file is None:
        output_file = 'exports/wordle_complete_export.html'
    elif not os.path.isabs(output_file):
        output_file = os.path.join('..', '..', 'exports', output_file)
    
    WordleCommon.print_header("Exporting Wordle Statistics")
    print(f"💾 Output file: {output_file}")
    
    # Export the HTML
    success = export_comprehensive_html(output_file)
    
    if success:
        print(f"✅ Export completed successfully!")
        abs_path = os.path.abspath(output_file)
        print(f"📄 File location: {abs_path}")
        return True
    else:
        print("❌ Export failed!")
        return False

def generate_video():
    """Generate Wordle videos with interactive menu"""
    target_dir = WordleCommon.setup_paths('video')
    
    WordleCommon.print_header("Wordle Video Generator", "🎬")
    print()
    print("Choose video type:")
    print("1. Modern 2D Animation (Recommended)")
    print("2. Modern 3D Animation")
    print("3. Basic Animation")
    print()
    
    choice = input("Enter choice (1-3): ").strip()
    
    if choice == '1':
        from wordle_video_modern import ModernWordleVideoGenerator
        generator = ModernWordleVideoGenerator()
        
        print("\n🎬 Creating Modern 2D Animation...")
        print("This creates a sliding window view (5-6 days visible)")
        print("Perfect for web viewing and exports!")
        
        filename = input("\nEnter filename (press Enter for default): ").strip()
        if not filename:
            filename = "media/wordle_final_2d.mp4"
        elif not os.path.isabs(filename):
            filename = os.path.join('..', '..', 'media', filename)
            
        generator.create_modern_2d_animation(filename)
        
    elif choice == '2':
        from wordle_video_modern import ModernWordleVideoGenerator
        generator = ModernWordleVideoGenerator()
        
        print("\n🎬 Creating Modern 3D Animation...")
        print("This creates a 3D visualization with depth")
        
        filename = input("\nEnter filename (press Enter for default): ").strip()
        if not filename:
            filename = "../../media/wordle_modern_3d.mp4"
        elif not os.path.isabs(filename):
            filename = os.path.join('..', '..', 'media', filename)
            
        generator.create_modern_3d_animation(filename)
        
    elif choice == '3':
        from wordle_video_generator import WordleVideoGenerator
        generator = WordleVideoGenerator()
        
        print("\n🎬 Creating Basic Animation...")
        
        filename = input("\nEnter filename (press Enter for default): ").strip()
        if not filename:
            filename = "../../media/wordle_basic.mp4"
        elif not os.path.isabs(filename):
            filename = os.path.join('..', '..', 'media', filename)
            
        generator.create_animation(filename)
        
    else:
        print("❌ Invalid choice!")
        return False
    
    return True

def main():
    """Main entry point with interactive menu"""
    print("🎯 Wordle Manager")
    print("================")
    print("1. Run Web Application")
    print("2. Export HTML")
    print("3. Generate Video")
    print("4. Export HTML with custom filename")
    print()
    
    choice = input("Enter choice (1-4): ").strip()
    
    if choice == '1':
        run_web_app()
    elif choice == '2':
        export_html()
    elif choice == '3':
        generate_video()
    elif choice == '4':
        filename = input("Enter output filename: ").strip()
        export_html(filename)
    else:
        print("❌ Invalid choice!")
        sys.exit(1)

if __name__ == '__main__':
    # Support command line arguments for backward compatibility
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command in ['--help', '-h', 'help']:
            print("Wordle Manager - Consolidated script for Wordle operations")
            print("\nUsage:")
            print("  python wordle_manager.py          # Interactive menu")
            print("  python wordle_manager.py web      # Run web application")
            print("  python wordle_manager.py export [filename]  # Export HTML")
            print("  python wordle_manager.py video    # Generate video")
            print("\nBackward compatibility commands:")
            print("  web    - Start the web application")
            print("  export - Export statistics to HTML")
            print("  video  - Generate visualization videos")
            sys.exit(0)
        elif command == 'web':
            run_web_app()
        elif command == 'export':
            filename = sys.argv[2] if len(sys.argv) > 2 else None
            export_html(filename)
        elif command == 'video':
            generate_video()
        else:
            print(f"❌ Unknown command: {command}")
            print("Available commands: web, export, video")
            print("Use --help for more information")
            sys.exit(1)
    else:
        main()