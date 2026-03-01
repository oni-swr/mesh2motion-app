import { type Scene, type Group, type Skeleton, type SkinnedMesh } from 'three'
import { ModalDialog } from '../lib/ModalDialog.ts'
import { SkeletonType } from '../lib/enums/SkeletonType.ts'

export interface TrackNameParts {
  bone_name: string
  property: string
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RetargetUtils {
  /**
   * Resets all SkinnedMeshes in the group to their rest pose
   */
  static reset_skinned_mesh_to_rest_pose (skinned_meshes_group: Scene): void {
    skinned_meshes_group.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        const skinned_mesh = child as SkinnedMesh
        const skeleton: Skeleton = skinned_mesh.skeleton
        skeleton.pose()
        skinned_mesh.updateMatrixWorld(true)
      }
    })
  }

  /**
   * Validates that the retargetable model contains SkinnedMeshes with bones
   * @returns true if valid SkinnedMeshes are found, false otherwise
   */
  static validate_skinned_mesh_has_bones (retargetable_model: Scene, show_error: boolean = true): boolean {
    // Collect all SkinnedMeshes
    let has_skinned_mesh_with_bones = false
    retargetable_model.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        has_skinned_mesh_with_bones = true
      }
    })

    // Check if we have any SkinnedMeshes
    if (!has_skinned_mesh_with_bones) {
      if (show_error) {
        new ModalDialog('No SkinnedMeshes found in file', 'Error opening file').show()
      }
      return false
    }

    console.log('skinned meshes found. ready to start retargeting process:', has_skinned_mesh_with_bones)
    return true
  }

  /**
   * Determines if our target rig is a perfect match to the source rig (M2M) by comparing bone names
   * When this happens, we don't need any bone mapping since we have a 1:1 match
   * @param source_armature Always a Mesh2Motion rig
   * @param target_armature user-uploaded rig
   * @returns boolean indicating if the bone names are identical
   */
  static are_source_and_target_bones_identical (source_armature: Group, target_armature: Scene): boolean {
    // if there is no target armature at all, return false
    if (!this.validate_skinned_mesh_has_bones(target_armature, false)) {
      return false
    }

    // collect all bones from source
    const source_bone_names: Set<string> = new Set<string>()
    source_armature.traverse((child) => {
      if (child.type === 'Bone') {
        source_bone_names.add(child.name)
      }
    })

    let all_bones_match = true
    target_armature.traverse((child) => {
      if (child.type === 'Bone') {
        if (!source_bone_names.has(child.name)) {
          all_bones_match = false
        }
      }
    })

    return all_bones_match
  }

  /**
   * Get the animation file path based on skeleton type
   */
  static get_animation_file_path (skeleton_type: SkeletonType): string | null {
    switch (skeleton_type) {
      case SkeletonType.Human:
        return '/animations/human-base-animations.glb'
      case SkeletonType.Quadraped:
        return '/animations/quad-creature-animations.glb'
      case SkeletonType.Bird:
        return '/animations/bird-animations.glb'
      case SkeletonType.Dragon:
        return '/animations/dragon-animations.glb'
      default:
        return null
    }
  }

  /**
   * Create a track name in the format expected by Three.js
   * For named bones, use: BoneName.property
   */
  static create_track_name (bone_name: string, property: string): string {
    return `${bone_name}.${property}`
  }

  /**
   * Parse a track name to extract bone name and property (e.g., "quaternion", "position", "scale")
   * Handles various formats like "boneName.property" or ".bones[boneName].property"
   */
  static parse_track_name_for_metadata (track_name: string): TrackNameParts | null {
    // Try format: "boneName.property"
    const simple_match = track_name.match(/^([^.]+)\.(.+)$/)
    if (simple_match !== null) {
      return {
        bone_name: simple_match[1],
        property: simple_match[2]
      }
    }

    // Try format: ".bones[boneName].property"
    const bones_match = track_name.match(/\.bones\[([^\]]+)\]\.(.+)$/)
    if (bones_match !== null) {
      return {
        bone_name: bones_match[1],
        property: bones_match[2]
      }
    }

    return null
  }

  /**
   * Create a reverse mapping: source bone name -> array of target bone names
   * Useful when original map is target -> source but processing needs source -> targets.
   */
  static reverse_bone_mapping (bone_mappings: Map<string, string>): Map<string, string[]> {
    const reverse_mappings = new Map<string, string[]>()
    bone_mappings.forEach((source_bone_name, target_bone_name) => {
      if (!reverse_mappings.has(source_bone_name)) {
        reverse_mappings.set(source_bone_name, [])
      }

      const target_list = reverse_mappings.get(source_bone_name)
      if (target_list !== undefined) {
        target_list.push(target_bone_name)
      }
    })

    return reverse_mappings
  }
}
