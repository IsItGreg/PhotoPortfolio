from PIL import Image
import sys

def add_white_border(image_path, border_size):
  # Open the image
  img = Image.open(image_path)
  
  # Get dimensions
  width, height = img.size
  
  # Create new image with border
  new_width = width + (2 * border_size)
  new_height = height + (2 * border_size)
  bordered = Image.new('RGB', (new_width, new_height), 'white')
  
  # Paste original image in center
  bordered.paste(img, (border_size, border_size))
  
  # Save with _bordered suffix
  output_path = image_path.rsplit('.', 1)[0] + '_bordered.webp'
  bordered.save(output_path, 'webp')
  print(f"Saved bordered image to {output_path}")

if __name__ == "__main__":
    import os
    
    print("Current directory:", os.getcwd())
    print("\nVisible folders:")
    for item in os.listdir('.'):
        if os.path.isdir(item):
            print(f"- {item}")
    images = [
      "public/images/2022/DSCF4505.webp",
      "public/images/2022/DSCF4507.webp",
      "public/images/2022/DSCF4509.webp",
      "public/images/2023/DSCF7582.webp",
      "public/images/2023/DSCF7635.webp",
      "public/images/2023/DSCF7602.webp",
      "public/images/2022/DSCF5091.webp",
      "public/images/2023/DSCF8140.webp",
      "public/images/2023/DSCF7683.webp",
      "public/images/2023/DSCF7704.webp",
      "public/images/2023/DSCF7995.webp",
      "public/images/2023/DSCF7867.webp",
      "public/images/2023/DSCF8837.webp",
      "public/images/2023/DSCF8814.webp",
    ]

        
    for image in images:
      add_white_border(image, 50)


